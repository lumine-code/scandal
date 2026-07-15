const fs = require("fs");
const {Readable} = require('stream');
const {StringDecoder} = require('string_decoder');

function lastIndexOf(buffer, length, char) {
  let i = length;
  while (i--) {
    if (buffer[i] === char) { return i; }
  }
  return -1;
}

// Treat a file as binary when its header contains a NUL byte, unless a Unicode
// byte-order mark marks it as UTF-16/32 text (which legitimately contains NULs).
// This is the same heuristic the isbinaryfile package applied here.
function isBinaryHeader(buffer, bytesRead) {
  if (bytesRead === 0) { return false; }
  const length = Math.min(bytesRead, buffer.length);
  if (length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) { return false; } // UTF-16/32 LE
  if (length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) { return false; } // UTF-16 BE
  if (length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) { return false; } // UTF-8
  for (let i = 0; i < length; i++) {
    if (buffer[i] === 0) { return true; }
  }
  return false;
}

// Will ensure data will be read on a line boundary. So this will always do the
// right thing:
//
//   lines = []
//   reader = new ChunkedLineReader('some/file.txt')
//   reader.on 'data', (chunk) ->
//     line = chunk.toString().replace(/\r?\n?$/, '')
//     lines = lines.concat(line.split(/\r\n|\n|\r/))
//
// This will collect all the lines in the file, or you can process each line in
// the data handler for more efficiency.
module.exports =
class ChunkedLineReader extends Readable {
  constructor(filePath, options) {
    super();
    this.encoding = options?.encoding ?? "utf8";
    this.filePath = filePath;

    this.CHUNK_SIZE = 10240;
    this.chunkedBuffer = null;
    this.headerBuffer = Buffer.alloc(256);
  }

  isBinaryFile() {
    const fd = fs.openSync(this.filePath, "r");
    const isBin = isBinaryHeader(this.headerBuffer, fs.readSync(fd, this.headerBuffer, 0, 256));
    fs.closeSync(fd);
    return isBin;
  }

  _read() {
    let fd;
    try {
      fd = fs.openSync(this.filePath, "r");
      let offset = 0;
      let remainder = '';
      const chunkSize = this.CHUNK_SIZE;
      if (
        isBinaryHeader(
          this.headerBuffer,
          fs.readSync(fd, this.headerBuffer, 0, 256)
        )
      ) {
        return;
      }

      if (this.chunkedBuffer == null) {
        this.chunkedBuffer = Buffer.alloc(chunkSize);
      }
      const chunkedBuffer = this.chunkedBuffer;
      let bytesRead = fs.readSync(fd, chunkedBuffer, 0, chunkSize, 0);
      const decoder = new StringDecoder(this.encoding);

      while (bytesRead) {
        // Scary looking. Uses very few new objects
        var newRemainder, str;
        const char = 10;
        const index = lastIndexOf(chunkedBuffer, bytesRead, char);

        if (index < 0) {
          // no newlines here, the whole thing is a remainder
          newRemainder = decoder.write(chunkedBuffer.slice(0, bytesRead));
          str = null;
        } else if ((index > -1) && (index === (bytesRead - 1))) {
          // the last char is a newline
          newRemainder = '';
          str = decoder.write(chunkedBuffer.slice(0, bytesRead));
        } else {
          str = decoder.write(chunkedBuffer.slice(0, index+1));
          newRemainder = decoder.write(chunkedBuffer.slice(index+1, bytesRead));
        }

        if (str) {
          if (remainder) { str = remainder + str; }
          this.push(str);
          remainder = newRemainder;
        } else {
          remainder = remainder + newRemainder;
        }

        offset += bytesRead;
        bytesRead = fs.readSync(fd, chunkedBuffer, 0, chunkSize, offset);
      }

      if (remainder) { return this.push(remainder); }

    } catch (error) {
      return this.emit('error', error);
    }

    finally {
      if (fd != null) { fs.closeSync(fd); }
      this.push(null);
    }
  }
}

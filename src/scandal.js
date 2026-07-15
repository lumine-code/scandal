const {ArgumentParser} = require('argparse');
const PathSearcher = require('./path-searcher');
const PathScanner = require('./path-scanner');
const PathReplacer = require('./path-replacer');
const path = require("path");

const SingleProcess = require('./single-process-search');
const {search, replace} = SingleProcess;
const singleProcessScanMain = SingleProcess.scanMain;
const singleProcessSearchMain = SingleProcess.searchMain;
const singleProcessReplaceMain = SingleProcess.replaceMain;

/*
This CLI is mainly for benchmarking. While there may be useful data output to
the console, it will probably change. The options will probably change as
well.
*/
const main = function() {
  const argParser = new ArgumentParser({
    description: 'List paths, search, and replace in a directory'
  });

  argParser.add_argument('-v', '--version', {
    action: 'version',
    version: require('../package.json').version
  });
  argParser.add_argument('-e', '--excludeVcsIgnores', {action: 'store_true'});
  argParser.add_argument('-o', '--verbose', {action: 'store_true'});
  argParser.add_argument('-d', '--dryReplace', {action: 'store_true'});
  argParser.add_argument('-s', '--search');
  argParser.add_argument('-r', '--replace');
  argParser.add_argument('pathToScan');

  const options = argParser.parse_args();

  if (options.search && options.replace) {
    return singleProcessReplaceMain(options);
  } else if (options.search) {
    return singleProcessSearchMain(options);
  } else {
    return singleProcessScanMain(options);
  }
};

module.exports = {main, search, replace, PathSearcher, PathScanner, PathReplacer};

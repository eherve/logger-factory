'use strict';

var util = require('util');
var fs = require('fs');

function getDateString(date) {
  var day = date.getDate().toString();
  if (day.lenght === 1) { day = util.format('0%s', day); }
  var month = (date.getMonth() + 1).toString();
  if (month.lenght === 1) { month = util.format('0%s', month); }
  var year = date.getFullYear().toString();
  return util.format('%s-%s-%s', day, month, year);
}

module.exports.copyAndClearFile = function(srcFile, destFile) {
  var BUF_LENGTH = 64 * 1024, buff = new Buffer(BUF_LENGTH);
  var fdr = fs.openSync(srcFile, 'r');
  if (util.isError(fdr)) { return fdr; }
  var fdw = fs.openSync(destFile, 'w');
  if (util.isError(fdw)) {
    fs.closeSync(fdr);
    return fdw;
  }
  var bytesRead = 1, pos = 0;
  while (bytesRead > 0) {
    bytesRead = fs.readSync(fdr, buff, 0, BUF_LENGTH, pos);
    fs.writeSync(fdw,buff,0,bytesRead);
    pos += bytesRead;
  }
  var errs = [], err;
  if ((err = fs.truncateSync(srcFile))) { errs.push(err); }
  if ((err = fs.closeSync(fdr))) { errs.push(err); }
  if ((err = fs.closeSync(fdw))) { errs.push(err); }
  return errs.length > 0 ? errs : null;
};

module.exports.dailyRotate = function(filename) {
  var current = new Date();
  var tomorrow = new Date(current.getFullYear(), current.getMonth(),
      current.getDate() + 1, 0, 0, 0, 0);
  var delay = tomorrow.getTime() - current.getTime();
  setTimeout(function() {
    var extIndex = filename.lastIndexOf('.');
    var newPath = util.format('%s_%s%s', filename.substring(0, extIndex),
      getDateString(current), filename.substring(extIndex));
    var err = module.exports.copyAndClearFile(filename, newPath);
    if (err) { require('../logger').get('FileTool').error(err); }
    module.exports.dailyRotate(filename);
  }, delay);
};

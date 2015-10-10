'use strict';

var util = require('util');
var path = require('path');
var fs = require('fs');
var winston = require('winston');
var mkdirp = require('mkdirp');
var events = require('events');
var CBuffer = require('CBuffer');
var FileTool = require('./file');

var LOGGING_BUFFER_SIZE = 25;

var settings;
var loggers = {};

/* Log Streaming */
function Stream() {
  events.EventEmitter.call(this);
  this.cbuffer = new CBuffer(LOGGING_BUFFER_SIZE);
}
util.inherits(Stream, events.EventEmitter);
Stream.prototype.setBufferSize = function(size) {
  var previous = this.cbuffer;
  this.cbuffer = new CBuffer(size);
  previous.forEach(function(data) {
    this.cbuffer.push(data);
  });
};
Stream.prototype.history = function() {
  return this.cbuffer;
};
Stream.prototype.source = function(logger) {
  var self = this;
  logger.on('logging', function(transport, level, msg, meta) {
    var data = { transport: transport, level: level, msg: msg, meta: meta,
      time: Date.now() };
    self.cbuffer.push(data);
    self.emit('logging', data);
  });
};
var stream = module.exports.stream = new Stream();
/**/

/* Outputs */
function addConsoleOutput(logger, settings) {
  var options = JSON.parse(JSON.stringify(settings));
  options.label = logger.label;
  logger.add(winston.transports.Console, options);
}

function addFileOutput(logger, settings) {
  var options = JSON.parse(JSON.stringify(settings));
  options.label = logger.label;
  var filename = options.filename || 'app.log';
  if (filename.indexOf('/') !== 0) {
    filename = path.join(__dirname, '..', filename);
    }
  var nameIndex = filename.lastIndexOf('/');
  if (!fs.existsSync(filename.substring(0, nameIndex))) {
    mkdirp.sync(filename.substring(0, nameIndex));
  }
  options.filename = filename;
  logger.add(winston.transports.File, options);
  if (options.rotation === true) {
    FileTool.dailyRotate(filename);
  }
}
/**/

var getLevels = module.exports.getLevels = function(name) {
	if (name !== undefined) {
		var logger = loggers[name]; var level = {};
		if (logger && logger.transports.console) {
			level.console = logger.transports.console.level;
		}
		if (logger && logger.transports.file) {
			level.file = logger.transports.file.level;
		}
		return level;
	}
	var levels = {};
	Object.keys(loggers).forEach(function(lvl) {
		var logger = loggers[lvl]; var level = levels[lvl] = {};
		if (logger.transports.console) {
			level.console = logger.transports.console.level;
		}
		if (logger.transports.file) {
			level.file = logger.transports.file.level;
		}
	});
	return levels;
};

module.exports.setLevels = function(name, transport, level) {
	if (arguments.length === 2) {
		level = transport; transport = name; name = undefined;
	}
	if (arguments.length === 1) {
		level = name; transport = undefined; name = undefined;
	}
	var lgs = [];
	if (name !== undefined) { lgs.push(loggers[name]); }
	else {
		Object.keys(loggers).forEach(function(key) { lgs.push(loggers[key]); });
	}
	lgs.forEach(function(l) {
		if (transport !== undefined) {
			if (l.transports[transport]) { l.transports[transport].level = level; }
		} else {
			if (l.transports.console) { l.transports.console.level = level; }
			if (l.transports.file) { l.transports.file.level = level; }
		}
	});
};

var isDebug = function() {
	var levels = getLevels(this.label);
	var transports = Object.keys(levels);
	for (var index = 0; index < transports.length; ++index) {
		var level = levels[transports[index]];
		if (level === 'debug' || level === 'all') {
			return true;
		}
	}
	return false;
};

module.exports.get = function(name) {
  if (!name) { name = 'default'; }
  if (loggers[name]) { return loggers[name]; }
  var logger = loggers[name] = new (winston.Logger)({ exitOnError: false });
  stream.source(logger);
  logger.label = name;
  if (!settings || !settings.outputs) { return logger; }
  if (settings.outputs.console) {
    addConsoleOutput(logger, settings.outputs.console);
    if (settings.levels && settings.levels[name] &&
        settings.levels[name].console) {
      logger.transports.console.level = settings.levels[name].console;
    }
  }
  if (settings.outputs.file) {
    addFileOutput(logger, settings.outputs.file);
    if (settings.levels && settings.levels[name] &&
        settings.levels[name].file) {
      logger.transports.console.level = settings.levels[name].file;
    }
  }
  // START FIXME: should be fixed in next winston version
  var oldLogger = logger.log;
  logger.log = function() {
    for (var index = 0; index < arguments.length; ++index) {
      if (util.isError(arguments[index])) {
        arguments[index] = arguments[index].message;
      }
    }
    oldLogger.apply(this, arguments);
  };
  //  END  FIXME
	logger.isDebug = isDebug;
  return logger;
};

module.exports.configure = function(options) {
  settings = options;
  if (settings.bufferSize) { stream.setBufferSize(settings.bufferSize); }
};

module.exports.expressLogger = function(req, res, next) {
  var start = Date.now();
  var _end = res.end;
  res.end = function(chunk, encoding) {
    var duration = Date.now() - start;
    var status = res.statusCode;
    var level = 'info';
    res.end = _end;
    res.end(chunk, encoding);
    module.exports.get('Express').log(level,
      util.format('%s %s %s - %s ms', req.method, req.originalUrl,
        status, duration));
  };
  next();
};
'use strict';

const util = require('util');
const Events = require('events');
const CBuffer = require('CBuffer');

const LOGGING_BUFFER_SIZE = 25;

function Stream() {
  Events.EventEmitter.call(this);
  this.cbuffer = new CBuffer(LOGGING_BUFFER_SIZE);
}
util.inherits(Stream, Events.EventEmitter);
Stream.prototype.setBufferSize = function (size) {
  var previous = this.cbuffer;
  this.cbuffer = new CBuffer(size);
  previous.forEach(function (data) {
    this.cbuffer.push(data);
  });
};
Stream.prototype.history = function () {
  return this.cbuffer;
};
Stream.prototype.source = function (logger) {
  var self = this;
  logger.on('logging', function (transport, level, msg, meta) {
    var data = {
      transport: transport, level: level, msg: msg, meta: meta,
      time: Date.now()
    };
    self.cbuffer.push(data);
    self.emit('logging', data);
  });
};
module.exports = new Stream();
'use strict';

const Stream = require('stream');
const inherits = require('util').inherits;

function StringStream(init) {
  Stream.super_.call(this);
  this._data = init || '';
}

inherits(StringStream, Stream);

/**
 * Reads the given n bytes from the stream.
 * @param {Number} n Number of bytes to read.
 */

StringStream.prototype.read = function (n) {
  let chunk;
  n = (n == null || n === -1) ? undefined : n;
  chunk = this._data.slice(0, n);
  /*! All read bytes are removed from the buffer. */
  this._data = this._data.slice(n);
  if (n >= this._data.length || n === -1) this.emit('end');
  return chunk;
};

StringStream.prototype.pipe = function (dest) {
  dest.end(this.read());
  return dest;
};

StringStream.prototype.write = function (data) {
  this._data += data;
};

StringStream.prototype.end = function (data) {
  if (data) {
    this.write.apply(this, arguments);
  }
  this.emit('end');
};

StringStream.prototype.toString = function () {
  return this._data;
};

module.exports = StringStream;

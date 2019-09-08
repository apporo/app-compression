'use strict';

const assert = require('assert');
const Devebot = require('devebot');
const Bluebird = Devebot.require('bluebird');
const lodash = Devebot.require('lodash');

const archiver = require('archiver');
const stream = require('stream');
const fetch = require('node-fetch');
const StringStream = require('./string-stream');

const emptyStream = new StringStream();

fetch.Promise = Bluebird;

function CompressionHelper (params = {}) {
  let { logger, tracer, errorBuilder, compressionLevel, stopOnError } = params;

  assert.ok(!lodash.isNil(logger));
  assert.ok(!lodash.isNil(tracer));
  assert.ok(!lodash.isNil(errorBuilder));

  compressionLevel = compressionLevel || 9;

  const refs = { logger, tracer, errorBuilder, compressionLevel, stopOnError };

  this.deflate = function (args = {}, opts = {}) {
    const { writer } = args;
    const { language } = opts;
    if (!isWritableStream(writer)) {
      return Bluebird.reject(errorBuilder.newError('InvalidStreamWriter', {
        language,
        payload: {
          writerType: (typeof writer),
          writerName: writer && writer.constructor && writer.constructor.name,
        }
      }));
    }
    return deflateDescriptors(args, Object.assign({}, opts, refs));
  }
}

module.exports = CompressionHelper;

function isPureObject (o) {
  return o && (typeof o === 'object') && !Array.isArray(o);
}

function isReadableStream (readable) {
  if (readable instanceof stream) return true;
  if (readable instanceof stream.Readable) return true;
  return false;
}

function isWritableStream (writable) {
  if (writable instanceof stream) return true;
  if (writable instanceof stream.Writable) return true;
  if (!isPureObject(writable)) return false;
  if (!lodash.isFunction(writable.write)) return false;
  if (!lodash.isFunction(writable.end)) return false;
  return true;
}

function deflateDescriptors (args = {}, opts = {}) {
  const { logger: L, tracer: T, errorBuilder, compressionLevel, requestId } = opts;
  const { descriptors, writer } = args;

  return new Bluebird(function(resolved, rejected) {
    const zipper = archiver('zip', {
      zlib: {
        level: compressionLevel
      }
    });

    zipper.on('warning', function(warn) {
      L.has('debug') && L.log('debug', T.add({ requestId, warn }).toMessage({
        tmpl: 'Req[${requestId}] warning: ${warn}'
      }));
      if (warn.code === 'ENOENT') {
        // log warning
      } else {
        // throw error
        rejected(warn);
      }
    });

    zipper.on('progress', function ({ entries }) {
      L.has('debug') && L.log('debug', T.add({ requestId, entries }).toMessage({
        tmpl: 'Req[${requestId}] progress: ${entries}'
      }));
    })

    zipper.on('error', function(err) {
      L.has('error') && L.log('error', T.add({
        requestId,
        error: {
          name: err.name, message: err.message
        }
      }).toMessage({
        tmpl: 'Req[${requestId}] compression has an error: ${error}'
      }));
      rejected(err);
    });

    zipper.on('finish', function() {
      L.has('info') && L.log('info', T.add({ requestId }).toMessage({
        tmpl: 'Req[${requestId}] compression has finished'
      }));
      resolved();
    });

    // pipe zipper data to the stream
    zipper.pipe(writer);

    Bluebird.mapSeries(descriptors, function(descriptor) {
      return deflateDescriptor(zipper, descriptor, opts).catch(function(err) {
        return err;
      });
    })
    .catch(function (err) {
      rejected(err);
    })
    .finally(function() {
      zipper.finalize();
    });
  });
}

function deflateDescriptor (zipper, descriptor = {}, opts = {}) {
  let { type, source, target } = descriptor;
  let { logger: L, tracer: T, errorBuilder, stopOnError, requestId } = opts;

  switch (type) {
    case 'href': {
      return fetch(source)
      .then(function (res) {
        if (!res.ok) {
          L.has('debug') && L.log('debug', T.add({
            requestId,
            url: source,
            statusCode: res.status,
          }).toMessage({
            tmpl: 'Req[${requestId}] response from <${url}> is invalid (statusCode: ${statusCode})'
          }));
          if (stopOnError) {
            return Bluebird.reject(errorBuilder.newError('HttpResourceRespStatusIsNotOk'));
          }
          return emptyStream;
        }
        return res.body;
      })
      .then(function (reader) {
        if (!isReadableStream(reader)) {
          L.has('debug') && L.log('debug', T.add({ requestId }).toMessage({
            tmpl: 'Req[${requestId}] response body must be a stream.Readable'
          }));
          if (stopOnError) {
            return Bluebird.reject(errorBuilder.newError('HttpResourceRespBodyIsInvalid'));
          }
          reader = emptyStream;
        }
        return zipper.append(reader, { name: target });
      })
      .catch(function (err) {
        L.has('debug') && L.log('debug', T.add({ requestId }).toMessage({
          tmpl: 'Req[${requestId}] fetch() call is error'
        }));
        if (stopOnError) {
          return Bluebird.reject(err);
        }
        return zipper;
      });
    }
    case 'file': {
      return Bluebird.resolve(zipper.file(source, { name: target }));
    }
    case 'directory': {
      if (lodash.isString(target)) {
        return Bluebird.resolve(zipper.directory(source, target));
      } else {
        return Bluebird.resolve(zipper.directory(source, false));
      }
    }
    default: {
      if (stopOnError) {
        return Bluebird.reject(errorBuilder.newError('ResourceTypeUnsupported', {
          payload: {
            descriptor
          },
          language
        }));
      }
      return Bluebird.resolve(zipper);
    }
  }
}

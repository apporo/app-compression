'use strict';

const assert = require('assert');
const Devebot = require('devebot');
const Bluebird = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');

const archiver = require('archiver');
const http = require('http');
const stream = require('stream');
const fetch = require('node-fetch');

fetch.Promise = Bluebird;

function CompressionHelper (params = {}) {
  let { logger, tracer, errorBuilder } = params;

  assert.ok(!lodash.isNil(logger));
  assert.ok(!lodash.isNil(tracer));
  assert.ok(!lodash.isNil(errorBuilder));

  const refs = { logger, tracer, errorBuilder };

  this.deflate = function (args = {}, opts = {}) {
    const { writer } = args;
    const { language } = opts;
    if (!isStreamWritable(writer)) {
      return Bluebird.reject(errorBuilder.newError('InvalidStreamWriter', {
        language,
        payload: {
          writerType: (typeof writer)
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

function isStreamWritable (writable) {
  if (writable instanceof stream.Writable) return true;
  if (writable instanceof http.ServerResponse) return true;
  if (!isPureObject(writable)) return false;
  if (writable.constructor.name === 'ServerResponse') return true;
  if (!lodash.isFunction(writable.write)) return false;
  if (!lodash.isFunction(writable.end)) return false;
  return true;
}

function deflateDescriptors (args = {}, opts = {}) {
  const { logger: L, tracer: T, errorBuilder, requestId } = opts;
  const { descriptors, writer } = args;

  return new Bluebird(function(resolved, rejected) {
    const zipper = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
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
  let { logger: L, tracer: T, errorBuilder, requestId } = opts;

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
          return Bluebird.reject(errorBuilder.newError('ResponseStatusIsNotOk'));
        }
        return res.body;
      })
      .then(function (reader) {
        if (!(reader instanceof stream.Readable)) {
          L.has('debug') && L.log('debug', T.add({ requestId }).toMessage({
            tmpl: 'Req[${requestId}] response body must be a stream.Readable'
          }));
          return Bluebird.reject(errorBuilder.newError('ResponseBodyIsInvalid'));
        }
        return zipper.append(reader, { name: target });
      })
      .catch(function (err) {
        L.has('debug') && L.log('debug', T.add({ requestId }).toMessage({
          tmpl: 'Req[${requestId}] fetch() call is error'
        }));
        return Bluebird.reject(err);
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
    default:
      return Bluebird.reject();
  }
}

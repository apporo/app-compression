'use strict';

const assert = require('assert');
const Devebot = require('devebot');
const Bluebird = Devebot.require('bluebird');
const lodash = Devebot.require('lodash');

const archiver = require('archiver');
const stream = require('stream');
const fetch = require('node-fetch');
const fileType = require('file-type');
const slugify = require('slugify');
const StringStream = require('./string-stream');

const emptyStream = new StringStream();

fetch.Promise = Bluebird;

function CompressionHelper (params = {}) {
  let { logger, tracer, errorBuilder, compressionLevel, stopOnError, skipOnError } = params;

  assert.ok(!lodash.isNil(logger));
  assert.ok(!lodash.isNil(tracer));
  assert.ok(!lodash.isNil(errorBuilder));

  compressionLevel = compressionLevel || 9;

  const refs = { logger, tracer, errorBuilder, compressionLevel, stopOnError, skipOnError };

  this.deflate = function (args = {}, opts = {}) {
    const { writer } = args;
    const { languageCode } = opts;
    if (!isWritableStream(writer)) {
      return Bluebird.reject(errorBuilder.newError('InvalidStreamWriter', {
        payload: {
          writerType: (typeof writer),
          writerName: writer && writer.constructor && writer.constructor.name,
        },
        language: languageCode,
      }));
    }
    return deflateResources(args, Object.assign({}, opts, refs));
  }
}

CompressionHelper.DEFLATE_ARGUMENTS_SCHEMA = {
  "type": "object",
  "properties": {
    "resources": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "$ref": "#/definitions/HttpResource"
          },
          {
            "$ref": "#/definitions/FileResource"
          }
        ]
      }
    }
  },
  "required": [ "resources" ],
  "definitions": {
    "HttpResource": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [ "http", "href" ]
        },
        "options": {
          "type": "object",
          "properties": {
            "method": {
              "type": "string"
            }
          }
        },
        "source": {
          "type": "string"
        },
        "target": {
          "type": "string"
        }
      },
      "required": [ "type", "source", "target" ]
    },
    "FileResource": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [ "file", "directory" ]
        },
        "source": {
          "type": "string"
        },
        "target": {
          "type": "string"
        }
      },
      "required": [ "type", "source", "target" ]
    }
  }
};

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

function deflateResources (args = {}, opts = {}) {
  const { logger: L, tracer: T, compressionLevel, requestId } = opts;
  const { resources, writer } = args;

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

    Bluebird.mapSeries(resources, function(resource) {
      return deflateResource(zipper, resource, opts);
    })
    .catch(function (err) {
      rejected(err);
    })
    .finally(function() {
      zipper.finalize();
    });
  });
}

function deflateResource (zipper, resource = {}, opts = {}) {
  let { type, source, target, extension } = resource;
  let { logger: L, tracer: T, errorBuilder, stopOnError, skipOnError, requestId, languageCode } = opts;

  switch (type) {
    case 'http':
    case 'href': {
      let fetchOpts = {};
      if (isPureObject(resource.options)) {
        fetchOpts = lodash.merge(fetchOpts, lodash.pick(resource.options, [
          'method', 'headers'
        ]));
      }
      return fetch(source, fetchOpts)
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
        if (!isReadableStream(res.body)) {
          L.has('debug') && L.log('debug', T.add({ requestId }).toMessage({
            tmpl: 'Req[${requestId}] response body must be a readable stream'
          }));
          if (stopOnError) {
            return Bluebird.reject(errorBuilder.newError('HttpResourceRespBodyIsInvalid'));
          }
          return emptyStream;
        }
        return res.body;
      })
      .then(function (reader) {
        if (skipOnError && reader === emptyStream) {
          return zipper;
        }
        target = slugify(target, { lower: true });
        if (!extension && reader !== emptyStream) {
          return fileType.stream(reader).then(function (wrappedStream) {
            let ext = wrappedStream.fileType.ext;
            return zipper.append(wrappedStream, { name: buildFilename(target, ext) });
          })
        }
        return zipper.append(reader, { name: buildFilename(target, extension) });
      })
      .catch(function (err) {
        L.has('debug') && L.log('debug', T.add({ requestId }).toMessage({
          tmpl: 'Req[${requestId}] fetch() raises an error'
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
            resource
          },
          language: languageCode,
        }));
      }
      return Bluebird.resolve(zipper);
    }
  }
}

function buildFilename (filename, extension) {
  if (extension) {
    const dot_ext = '.' + extension;
    if (!filename.endsWith(dot_ext)) {
      return filename + dot_ext;
    }
  }
  return filename;
}

'use strict';

var devebot = require('devebot');
var lodash = devebot.require('lodash');
var assert = require('liberica').assert;
var mockit = require('liberica').mockit;
var sinon = require('liberica').sinon;
var path = require('path');

const fs = require('fs');
const CompressionHelper = require('../../lib/supports/compression-helper');

describe('supports/compression-helper', function() {
  var app = require(path.join(__dirname, '../app/example'));
  var sandboxConfig = lodash.get(app.config, ['sandbox', 'default', 'plugins', 'appCompression']);
  var errorManager = app.server.getSandboxService('manager', { scope: 'app-errorlist' });

  var loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
  var ctx = {
    logger: loggingFactory.getLogger(),
    tracer: loggingFactory.getTracer(),
    errorBuilder: errorManager.getErrorBuilder('app-compression')
  }

  var compressionHelper = new CompressionHelper(lodash.assign(ctx, {
  }));

  it('compression a folder', function() {
    return compressionHelper.deflate({
      resources: [
        {
          type: 'directory',
          source: path.join(__dirname, '../data/files'),
          target: 'subdata/items'
        },
        {
          type: 'http',
          source: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
          target: 'PLDI 09'
        },
        {
          type: 'href',
          source: 'http://acegik.net/blog/images/logo.png',
          target: 'My logo',
          // extension: 'png'
        }
      ],
      writer: fs.createWriteStream(path.join(__dirname, '../data/target.zip'))
    });
  });
});

'use strict';

const Devebot = require('devebot');
const lodash = Devebot.require('lodash');

const CompressionHelper = require('../supports/compression-helper');

function Service (params = {}) {
  const { packageName, sandboxConfig, loggingFactory, errorManager } = params;

  const compressor = new CompressionHelper(lodash.assign({
    logger: loggingFactory.getLogger(),
    tracer: loggingFactory.getTracer(),
    errorBuilder: errorManager.register(packageName, {
      errorCodes: sandboxConfig.errorCodes
    })
  }, lodash.pick(sandboxConfig, ['zipLevel', 'stopOnError', 'skipOnError', 'letterCase'])));

  this.deflate = function (args = {}, opts = {}) {
    return compressor.deflate(args, opts);
  }
}

module.exports = Service;

Service.referenceHash = {
  errorManager: 'app-errorlist/manager'
}

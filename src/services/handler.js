'use strict';

const CompressionHelper = require('../supports/compression-helper');

function Service (params = {}) {
  const { packageName, sandboxConfig, loggingFactory, errorManager } = params;

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();

  const errorBuilder = errorManager.getErrorBuilder(packageName);

  const compressor = new CompressionHelper({ logger: L, tracer: T, errorBuilder });

  this.deflate = function (args = {}, opts = {}) {
    return compressor.deflate(args, opts);
  }
}

module.exports = Service;

Service.referenceHash = {
  initializer: 'initializer',
  errorManager: 'app-errorlist/manager'
}

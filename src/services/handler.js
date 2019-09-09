'use strict';

const Devebot = require('devebot');
const lodash = Devebot.require('lodash');

const CompressionHelper = require('../supports/compression-helper');

function Service (params = {}) {
  const { packageName, sandboxConfig, loggingFactory, errorManager } = params;

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();

  const errorBuilder = errorManager.getErrorBuilder(packageName);

  const helperOptions = lodash.assign({
    logger: L,
    tracer: T,
    errorBuilder
  }, lodash.pick(sandboxConfig, ['compressionLevel', 'stopOnError', 'skipOnError']));

  const compressor = new CompressionHelper(helperOptions);

  this.deflate = function (args = {}, opts = {}) {
    return compressor.deflate(args, opts);
  }
}

module.exports = Service;

Service.referenceHash = {
  initializer: 'initializer',
  errorManager: 'app-errorlist/manager'
}

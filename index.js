'use strict';

var plugin = require('devebot').registerLayerware(__dirname, [
  'app-errorlist'
]);

var compressionHelper = require('./lib/supports/compression-helper');

plugin.DEFLATE_ARGUMENTS_SCHEMA = compressionHelper.DEFLATE_ARGUMENTS_SCHEMA;

module.exports = plugin;

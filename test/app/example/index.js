'use strict';

var app = require('devebot').launchApplication({
  appRootPath: __dirname
}, [{
  name: 'app-compression',
  path: require('path').join(__dirname, '../../../index.js')
}]);

if (require.main === module) app.server.start();

module.exports = app;

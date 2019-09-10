'use strict';

var devebot = require('devebot');
var lodash = devebot.require('lodash');
var assert = require('liberica').assert;
var mockit = require('liberica').mockit;
var sinon = require('liberica').sinon;
var path = require('path');

const slugify = require('../../lib/supports/string-slugify');

describe('supports/string-slugify', function() {
  it('slugify the unicode string', function() {
    assert.equal(slugify('HÓA ĐƠN', {
      locale: 'vi',
      lower: true
    }), 'hoa-don');
  });
});

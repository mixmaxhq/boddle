(function(QUnit) {

  var utils = Backbone.utils;

  QUnit.module('Backbone:utils');

  QUnit.test('splice', function(assert) {
    var array = [];

    // internal: push

    utils.splice(array, [1, 2], 0);
    assert.deepEqual(array, [1, 2]);
    array.length = 0;

    utils.splice(array, [1, 2], 1);
    assert.deepEqual(array, [1, 2]);

    // internal: Array#splice

    utils.splice(array, [1, 2], 1);
    assert.deepEqual(array, [1, 1, 2, 2]);

    // internal: spliceBulk / rcopy

    var chonk = new Array(16384).fill(3);

    utils.splice(array, chonk, 2);
    assert.deepEqual(array, [1, 1].concat(chonk, [2, 2]));

    utils.splice(array, chonk, array.length);
    assert.deepEqual(array, [1, 1].concat(chonk, [2, 2], chonk));

    utils.splice(array, chonk, 0);
    assert.deepEqual(array, chonk.concat([1, 1], chonk, [2, 2], chonk));
  });
})(QUnit);

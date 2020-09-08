// Proxy Backbone class methods to Underscore functions, wrapping the model's
// `attributes` object or collection's `models` array behind the scenes.
//
// collection.filter(function(model) { return model.get('age') > 10 });
// collection.each(this.addView);
//
// `Function#apply` can be slow so we use the method's arg count, if we know it.
const addMethod = function (base, length, method, attribute) {
  switch (length) {
    case 1:
      return function () {
        return base[method](this[attribute]);
      };
    case 2:
      return function (value) {
        return base[method](this[attribute], value);
      };
    case 3:
      return function (iteratee, context) {
        return base[method](this[attribute], cb(iteratee, this), context);
      };
    case 4:
      return function (iteratee, defaultVal, context) {
        return base[method](this[attribute], cb(iteratee, this), defaultVal, context);
      };
    default:
      return function () {
        const args = slice.call(arguments);
        args.unshift(this[attribute]);
        return base[method].apply(base, args);
      };
  }
};

const addUnderscoreMethods = function (Class, base, methods, attribute) {
  _.each(methods, function (length, method) {
    if (base[method]) Class.prototype[method] = addMethod(base, length, method, attribute);
  });
};

// Support `collection.sortBy('attr')` and `collection.findWhere({id: 1})`.
var cb = function (iteratee, instance) {
  if (_.isFunction(iteratee)) return iteratee;
  if (_.isObject(iteratee) && !instance._isModel(iteratee)) return modelMatcher(iteratee);
  if (_.isString(iteratee))
    return function (model) {
      return model.get(iteratee);
    };
  return iteratee;
};
var modelMatcher = function (attrs) {
  const matcher = _.matches(attrs);
  return function (model) {
    return matcher(model.attributes);
  };
};

// Underscore methods that we want to implement on the Collection.
// 90% of the core usefulness of Backbone Collections is actually implemented
// right here:
const collectionMethods = {
  forEach: 3,
  each: 3,
  map: 3,
  collect: 3,
  reduce: 0,
  foldl: 0,
  inject: 0,
  reduceRight: 0,
  foldr: 0,
  find: 3,
  detect: 3,
  filter: 3,
  select: 3,
  reject: 3,
  every: 3,
  all: 3,
  some: 3,
  any: 3,
  include: 3,
  includes: 3,
  contains: 3,
  invoke: 0,
  max: 3,
  min: 3,
  toArray: 1,
  size: 1,
  first: 3,
  head: 3,
  take: 3,
  initial: 3,
  rest: 3,
  tail: 3,
  drop: 3,
  last: 3,
  without: 0,
  difference: 0,
  indexOf: 3,
  shuffle: 1,
  lastIndexOf: 3,
  isEmpty: 1,
  chain: 1,
  sample: 3,
  partition: 3,
  groupBy: 3,
  countBy: 3,
  sortBy: 3,
  indexBy: 3,
  findIndex: 3,
  findLastIndex: 3,
};

// Underscore methods that we want to implement on the Model, mapped to the
// number of arguments they take.
const modelMethods = {
  keys: 1,
  values: 1,
  pairs: 1,
  invert: 1,
  pick: 0,
  omit: 0,
  chain: 1,
  isEmpty: 1,
};

// Mix in each Underscore method as a proxy to `Collection#models`.

_.each(
  [
    [Collection, collectionMethods, 'models'],
    [Model, modelMethods, 'attributes'],
  ],
  function (config) {
    const Base = config[0],
      methods = config[1],
      attribute = config[2];

    Base.mixin = function (obj) {
      const mappings = _.reduce(
        _.functions(obj),
        function (memo, name) {
          memo[name] = 0;
          return memo;
        },
        {}
      );
      addUnderscoreMethods(Base, obj, mappings, attribute);
    };

    addUnderscoreMethods(Base, _, methods, attribute);
  }
);

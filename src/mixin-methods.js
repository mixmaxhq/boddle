import _ from 'lodash';

// Proxy class methods to Underscore functions, wrapping the model's
// `attributes` object or collection's `models` array behind the scenes.
//
// collection.filter(function(model) { return model.get('age') > 10 });
// collection.each(this.addView);
//
// `Function#apply` can be slow so we use the method's arg count, if we know it.
export function mixinMethod(method, length, attribute) {
  switch (length) {
    case 1:
      return function () {
        return method(this[attribute]);
      };
    case 2:
      return function (value) {
        return method(this[attribute], value);
      };
    case 3:
      return function (iteratee, context) {
        return method(this[attribute], cb(iteratee, this), context);
      };
    case 4:
      return function (iteratee, defaultVal, context) {
        return method(this[attribute], cb(iteratee, this), defaultVal, context);
      };
    default:
      return function (...args) {
        args.unshift(this[attribute]);
        return method.apply(null, args);
      };
  }
}

export function mixinMethods(Class, methods, attribute) {
  for (const [name, method, length] of methods) {
    Class.prototype[name] = mixinMethod(method, length, attribute);
  }
}

// Support `collection.sortBy('attr')` and `collection.findWhere({id: 1})`.
function cb(iteratee, instance) {
  if (typeof iteratee === 'function') return iteratee;
  if (_.isObject(iteratee) && !instance._isModel(iteratee)) return modelMatcher(iteratee);
  if (typeof iteratee === 'string') return (model) => model.get(iteratee);
  return iteratee;
}

function modelMatcher(attrs) {
  const matcher = _.matches(attrs);
  return (model) => matcher(model.attributes);
}

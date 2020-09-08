// Create a local reference to common methods we'll want to use later.
export const slice = Array.prototype.slice;
export const hasOwn = Object.prototype.hasOwnProperty;

// Splices `insert` into `array` at index `at`.
export function splice(array, insert, at) {
  at = Math.min(Math.max(at, 0), array.length);
  const tail = Array(array.length - at);
  const length = insert.length;
  let i;
  for (i = 0; i < tail.length; i++) tail[i] = array[i + at];
  for (i = 0; i < length; i++) array[i + at] = insert[i];
  for (i = 0; i < tail.length; i++) array[i + length + at] = tail[i];
}

// Throw an error when a URL is needed, and none is supplied.
export function urlError() {
  throw new Error('A "url" property or function must be specified');
}

// Wrap an optional error callback with a fallback error event.
export function wrapError(model, options) {
  const { error } = options;
  options.error = function (resp) {
    if (error) error.call(options.context, model, resp, options);
    model.trigger('error', model, resp, options);
  };
}

export const keys =
  process.env.NODE_ENV === 'test'
    ? Object.keys
    : function* keys(obj) {
        for (const key in obj) {
          if (hasOwn.call(obj, key)) {
            yield key;
          }
        }
      };

export const keysIn =
  process.env.NODE_ENV === 'test'
    ? Object.keys
    : function* keysIn(obj) {
        for (const key in obj) {
          yield key;
        }
      };

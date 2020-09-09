// Create a local reference to common methods we'll want to use later.
export const slice = Array.prototype.slice;
export const hasOwn = Object.prototype.hasOwnProperty;

const { push: nativePush } = Array.prototype;

// At this point it's unreasonable to expect the javascript implementation to
// support unbounded stack allocation. This value chosen based on prior art:
// https://github.com/google/closure-library/commit/da353e0265ea32583ea1db9e7520dce5cceb6f6a#diff-13b3e2af02e1e9ddff26b515a7bf46afR53
const PUSH_BAILOUT = 8192;
const SPLICE_BAILOUT = PUSH_BAILOUT - 2;

// We should be able to use Array#copyWithin, but it's really slow - at least on
// Chrome 84 - for some reason. We copy in reverse specifically to avoid
// overwriting the src data before we've copied it.
// Precondition: if dest === src, then strictly: destIdx >= srcIdx
function rcopy(dest, src, destIdx, srcIdx, srcEnd) {
  const offset = destIdx - srcIdx;
  for (let i = srcEnd - 1; i >= srcIdx; --i) dest[i + offset] = src[i];
}

// When we need to insert more than SPLICE_BAILOUT items, we bail out and
// migrate the tail manually instead of trying to get
function spliceBulk(array, insert, at) {
  const nLength = insert.length,
    tailEnd = array.length;
  array.length += nLength;
  rcopy(array, array, at + nLength, at, tailEnd);
  rcopy(array, insert, at, 0, insert.length);
}

// Copy all the items from insert to the end of array.
function push(array, insert) {
  if (insert.length <= PUSH_BAILOUT) {
    return void nativePush.apply(array, insert);
  }

  // It's efficient to just repeatedly push, because this doesn't involve
  // copying a bunch of intermediate memory around.
  for (let i = 0; i < insert.length; ) {
    const next = i + PUSH_BAILOUT;
    nativePush.apply(array, insert.slice(i, next));
    i = next;
  }
}

// Splices `insert` into `array` at index `at`.
// Precondition: insert.length > 0
export function splice(array, insert, at) {
  if (at >= array.length) {
    return void push(array, insert);
  }

  at = Math.min(Math.max(at, 0), array.length);

  if (insert.length <= SPLICE_BAILOUT) {
    array.splice(at, 0, ...insert);
  } else {
    spliceBulk(array, insert, at);
  }
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

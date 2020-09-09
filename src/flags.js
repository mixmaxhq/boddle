// Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
// will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
// set a `X-Http-Method-Override` header.
// eslint-disable-next-line prefer-const
export let emulateHTTP = false;

// Turn on `emulateJSON` to support legacy servers that can't deal with direct
// `application/json` requests ... this will encode the body as
// `application/x-www-form-urlencoded` instead and will send the model in a
// form param named `model`.
// eslint-disable-next-line prefer-const
export let emulateJSON = false;

export function setEmulateHTTP(value) {
  emulateHTTP = value;
}

export function setEmulateJSON(value) {
  emulateJSON = value;
}

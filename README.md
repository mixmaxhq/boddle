# boddle

Backbone-inspired data layer, aiming at majority API compatibility with modern promises and no
underscore/jquery dependency.

To suggest a feature or report a bug:
https://github.com/mixmaxh/boddle/issues

Many thanks to Backbone's contributors:
https://github.com/jashkenas/backbone/graphs/contributors

Special thanks to Robert Kieffer for the original philosophy behind Backbone (and, indirectly,
boddle).
https://github.com/broofa

## install

```sh
$ npm i -P boddle
```

## notable differences

- No support for `View`, `Router`, `History`.
- Does not use jQuery, and replaces underscore with lodash.
- Does not support `Model#mixin` or `Collection#mixin`.
- Does not provide a global event bus (e.g. `Backbone.trigger` on global `Backbone`).
- Exports setter functions for previously-rewriteable exports:
  - `ajax` -> `setAJAXImplementation`
  - `emulateHTTP` -> `setEmulateHTTP`
  - `emulateJSON` -> `setEmulateJSON`
  - `sync` -> `setSyncImplementation`
- Supports standard `class`-`extend` syntax instead of requiring e.g. `Model.extend`.
- Potential for minor differences in method semantics. e.g. due to the `lodash` switch `Model#pick` does not support a function getter - use `Model#pickBy` instead.

// Throw an error when a URL is needed, and none is supplied.
const urlError = function () {
  throw new Error('A "url" property or function must be specified');
};

// Wrap an optional error callback with a fallback error event.
const wrapError = function (model, options) {
  const error = options.error;
  options.error = function (resp) {
    if (error) error.call(options.context, model, resp, options);
    model.trigger('error', model, resp, options);
  };
};

(function (QUnit) {
  const sync = Backbone.sync;
  const ajax = Backbone.ajax;
  const emulateHTTP = Backbone.emulateHTTP;
  const emulateJSON = Backbone.emulateJSON;
  const history = window.history;
  const pushState = history.pushState;
  const replaceState = history.replaceState;

  QUnit.config.noglobals = true;

  QUnit.testStart(function () {
    const env = QUnit.config.current.testEnvironment;

    // We never want to actually call these during tests.
    history.pushState = history.replaceState = function () {};

    // Capture ajax settings for comparison.
    Backbone.setAJAXImplementation(function (settings) {
      env.ajaxSettings = settings;
    });

    // Capture the arguments to Backbone.sync for comparison.
    Backbone.setSyncImplementation(function (method, model, options) {
      env.syncArgs = {
        method: method,
        model: model,
        options: options,
      };
      sync.apply(this, arguments);
    });
  });

  QUnit.testDone(function () {
    Backbone.sync = sync;
    Backbone.ajax = ajax;
    Backbone.emulateHTTP = emulateHTTP;
    Backbone.emulateJSON = emulateJSON;
    history.pushState = pushState;
    history.replaceState = replaceState;
  });
})(QUnit);

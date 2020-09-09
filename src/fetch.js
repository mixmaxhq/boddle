// Backbone.Fetch.js 1.0.0
// -----------------------

//     (c) 2016 Adam Krebs
//     Backbone.Fetch may be freely distributed under the MIT license.
//     For all details and documentation:
//     https://github.com/akre54/Backbone.Fetch
//
// cf. https://github.com/akre54/Backbone.Fetch/pull/10

import _ from 'lodash';

function stringifyGETParams(url, data) {
  const queryIndex = url.indexOf('?');
  const parsed = new URLSearchParams(queryIndex < 0 ? null : url.slice(queryIndex));
  for (const key in data) {
    if (!_.has(data, key)) continue;
    const value = data[key];
    if (value == null) continue;
    parsed.append(key, value);
  }
  return url.slice(0, queryIndex + 1) + parsed.toString();
}

function getData(response, dataType) {
  return dataType === 'json' && response.status !== 204 ? response.json() : response.text();
}

export default function ajax(options) {
  let url = options.url;
  if (options.type === 'GET' && options.data !== null && typeof options.data === 'object') {
    url = stringifyGETParams(url, options.data);
    delete options.data;
  }

  _.defaults(options, {
    method: options.type,
    headers: _.defaults(options.headers || {}, {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: options.data,
  });

  return fetch(url, options)
    .then((response) => {
      const promise =
        options.type === 'HEAD' ? Promise.resolve(null) : getData(response, options.dataType);

      if (response.ok) return promise;

      const error = new Error(response.statusText);
      return promise.then((responseData) => {
        error.response = response;
        error.responseData = responseData;
        if (options.error) options.error(error);
        throw error;
      });
    })
    .then((responseData) => {
      if (options.success) options.success(responseData);
      return responseData;
    });
}

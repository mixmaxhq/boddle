import { slice, splice, wrapError } from './utils';
import extend from './extend';
import { Model } from './Model';
import { sync } from './sync';
import _ from 'lodash';
import { mixinMethods } from './mixin-methods';
import { Events } from './events';

// Collection
// ----------

// Defining an @@iterator method implements JavaScript's Iterable protocol.
// In modern ES2015 browsers, this value is found at Symbol.iterator.
const $$iterator = typeof Symbol === 'function' && Symbol.iterator;

// If models tend to represent a single row of data, a Collection is more
// analogous to a table full of data ... or a small slice or page of that table,
// or a collection of rows that belong together for a particular reason
// -- all of the messages in this particular folder, all of the documents
// belonging to this particular author, and so on. Collections maintain indexes
// of their models, both in order, and for lookup by `id`.

// Default options for `Collection#set`.
const setOptions = { add: true, remove: true, merge: true };
const addOptions = { add: true, remove: false };

// Create a new **Collection**, perhaps to contain a specific type of `model`.
// If a `comparator` is specified, the Collection will maintain
// its models in sort order, as they're added and removed.
export const Collection = /*#__PURE__*/ (() => {
  // eslint-disable-next-line no-shadow
  const Collection = class Collection {
    static extend = extend;

    constructor(models, options = {}) {
      this.preinitialize.apply(this, arguments);
      if (options.model) this.model = options.model;
      if (options.comparator !== void 0) this.comparator = options.comparator;
      this._reset();
      this.initialize.apply(this, arguments);
      if (models) this.reset(models, { silent: true, ...options });
    }

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON(options) {
      return this.map((model) => model.toJSON(options));
    }

    // Proxy `sync` by default.
    sync(...args) {
      return sync.apply(this, args);
    }

    // Add a model, or list of models to the set. `models` may be Models or raw
    // JavaScript objects to be converted to Models, or any combination of the
    // two.
    add(models, options) {
      return this.set(models, { merge: false, ...options, ...addOptions });
    }

    // Remove a model, or a list of models from the set.
    remove(models, options) {
      options = { ...options };
      const singular = !Array.isArray(models);
      models = singular ? [models] : models.slice();
      const removed = this._removeModels(models, options);
      if (!options.silent && removed.length) {
        options.changes = { added: [], merged: [], removed: removed };
        this.trigger('update', this, options);
      }
      return singular ? removed[0] : removed;
    }

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set(models, options) {
      if (models == null) return;

      options = { ...setOptions, ...options };
      if (options.parse && !this._isModel(models)) {
        models = this.parse(models, options) || [];
      }

      const singular = !Array.isArray(models);
      models = singular ? [models] : models.slice();

      let at = options.at;
      if (at != null) at = +at;
      if (at > this.length) at = this.length;
      if (at < 0) at += this.length + 1;

      const set = [];
      const toAdd = [];
      const toMerge = [];
      const toRemove = [];
      const modelMap = {};

      const add = options.add;
      const merge = options.merge;
      const remove = options.remove;

      let sort = false;
      const sortable = this.comparator && at == null && options.sort !== false;
      const sortAttr = typeof this.comparator === 'string' ? this.comparator : null;

      // Turn bare objects into model references, and prevent invalid models
      // from being added.
      let model, i;
      for (i = 0; i < models.length; i++) {
        model = models[i];

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        const existing = this.get(model);
        if (existing) {
          if (merge && model !== existing) {
            let attrs = this._isModel(model) ? model.attributes : model;
            if (options.parse) attrs = existing.parse(attrs, options);
            existing.set(attrs, options);
            toMerge.push(existing);
            if (sortable && !sort) sort = existing.hasChanged(sortAttr);
          }
          if (!modelMap[existing.cid]) {
            modelMap[existing.cid] = true;
            set.push(existing);
          }
          models[i] = existing;

          // If this is a new, valid model, push it to the `toAdd` list.
        } else if (add) {
          model = models[i] = this._prepareModel(model, options);
          if (model) {
            toAdd.push(model);
            this._addReference(model, options);
            modelMap[model.cid] = true;
            set.push(model);
          }
        }
      }

      // Remove stale models.
      if (remove) {
        for (i = 0; i < this.length; i++) {
          model = this.models[i];
          if (!modelMap[model.cid]) toRemove.push(model);
        }
        if (toRemove.length) this._removeModels(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      let orderChanged = false;
      const replace = !sortable && add && remove;
      if (set.length && replace) {
        orderChanged =
          this.length !== set.length || _.some(this.models, (m, index) => m !== set[index]);
        this.models.length = 0;
        splice(this.models, set, 0);
        this.length = this.models.length;
      } else if (toAdd.length) {
        if (sortable) sort = true;
        splice(this.models, toAdd, at == null ? this.length : at);
        this.length = this.models.length;
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({ silent: true });

      // Unless silenced, it's time to fire all appropriate add/sort/update events.
      if (!options.silent) {
        for (i = 0; i < toAdd.length; i++) {
          if (at != null) options.index = at + i;
          model = toAdd[i];
          model.trigger('add', model, this, options);
        }
        if (sort || orderChanged) this.trigger('sort', this, options);
        if (toAdd.length || toRemove.length || toMerge.length) {
          options.changes = {
            added: toAdd,
            removed: toRemove,
            merged: toMerge,
          };
          this.trigger('update', this, options);
        }
      }

      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    }

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset(models, options) {
      options = { ...options };
      for (let i = 0; i < this.models.length; i++) {
        this._removeReference(this.models[i], options);
      }
      options.previousModels = this.models;
      this._reset();
      models = this.add(models, { silent: true, ...options });
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    }

    // Add a model to the end of the collection.
    push(model, options) {
      return this.add(model, { at: this.length, ...options });
    }

    // Remove a model from the end of the collection.
    pop(options) {
      const model = this.at(this.length - 1);
      return this.remove(model, options);
    }

    // Add a model to the beginning of the collection.
    unshift(model, options) {
      return this.add(model, { at: 0, ...options });
    }

    // Remove a model from the beginning of the collection.
    shift(options) {
      const model = this.at(0);
      return this.remove(model, options);
    }

    // Slice out a sub-array of models from the collection.
    slice(...args) {
      return slice.apply(this.models, args);
    }

    // Get a model from the set by id, cid, model object with id or cid
    // properties, or an attributes object that is transformed through modelId.
    get(obj) {
      if (obj == null) return void 0;
      return (
        this._byId[obj] ||
        this._byId[this.modelId(this._isModel(obj) ? obj.attributes : obj, obj.idAttribute)] ||
        (obj.cid && this._byId[obj.cid])
      );
    }

    // Returns `true` if the model is in the collection.
    has(obj) {
      return this.get(obj) != null;
    }

    // Get the model at the given index.
    at(index) {
      if (index < 0) index += this.length;
      return this.models[index];
    }

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where(attrs, first) {
      return this[first ? 'find' : 'filter'](attrs);
    }

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere(attrs) {
      return this.where(attrs, true);
    }

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort(options = {}) {
      let comparator = this.comparator;
      if (!comparator) throw new Error('Cannot sort a set without a comparator');

      const length = comparator.length;
      if (typeof comparator === 'function') comparator = comparator.bind(this);

      // Run sort based on type of `comparator`.
      if (length === 1 || typeof comparator === 'string') {
        this.models = this.sortBy(comparator);
      } else {
        this.models.sort(comparator);
      }
      if (!options.silent) this.trigger('sort', this, options);
      return this;
    }

    // Pluck an attribute from each model in the collection.
    pluck(attr) {
      return this.map(attr + '');
    }

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch(options) {
      options = { parse: true, ...options };
      const success = options.success;
      options.success = (resp) => {
        const method = options.reset ? 'reset' : 'set';
        this[method](resp, options);
        if (success) success.call(options.context, this, resp, options);
        this.trigger('sync', this, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    }

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create(model, options) {
      options = { ...options };
      const wait = options.wait;
      model = this._prepareModel(model, options);
      if (!model) return false;
      if (!wait) this.add(model, options);
      const success = options.success;
      options.success = (m, resp, callbackOpts) => {
        if (wait) this.add(m, callbackOpts);
        if (success) success.call(callbackOpts.context, m, resp, callbackOpts);
      };
      model.save(null, options);
      return model;
    }

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse(resp, options) {
      return resp;
    }

    // Create a new collection with an identical list of models as this one.
    clone() {
      return new this.constructor(this.models, {
        model: this.model,
        comparator: this.comparator,
      });
    }

    // Define how to uniquely identify models in the collection.
    modelId(attrs, idAttribute) {
      return attrs[idAttribute || this.model.prototype.idAttribute || 'id'];
    }

    // Get an iterator of all models in this collection.
    values() {
      return new CollectionIterator(this, ITERATOR_VALUES);
    }

    // Get an iterator of all model IDs in this collection.
    keys() {
      return new CollectionIterator(this, ITERATOR_KEYS);
    }

    // Get an iterator of all [ID, model] tuples in this collection.
    entries() {
      return new CollectionIterator(this, ITERATOR_KEYSVALUES);
    }

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset() {
      this.length = 0;
      this.models = [];
      this._byId = {};
    }

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel(attrs, options) {
      if (this._isModel(attrs)) {
        if (!attrs.collection) attrs.collection = this;
        return attrs;
      }
      options = { ...options, collection: this };
      const model = new this.model(attrs, options);
      if (!model.validationError) return model;
      this.trigger('invalid', this, model.validationError, {
        ...options,
        validationError: model.validationError,
      });
      return false;
    }

    // Internal method called by both remove and set.
    _removeModels(models, options) {
      const removed = [];
      for (let i = 0; i < models.length; i++) {
        const model = this.get(models[i]);
        if (!model) continue;

        const index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;

        // Remove references before triggering 'remove' event to prevent an
        // infinite loop. #3693
        delete this._byId[model.cid];
        const id = this.modelId(model.attributes, model.idAttribute);
        if (id != null) delete this._byId[id];

        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }

        removed.push(model);
        this._removeReference(model, options);
      }
      return removed;
    }

    // Method for checking whether an object should be considered a model for
    // the purposes of adding to the collection.
    _isModel(model) {
      return model instanceof Model;
    }

    // Internal method to create a model's ties to a collection.
    _addReference(model, options) {
      this._byId[model.cid] = model;
      const id = this.modelId(model.attributes, model.idAttribute);
      if (id != null) this._byId[id] = model;
      model.on('all', this._onModelEvent, this);
    }

    // Internal method to sever a model's ties to a collection.
    _removeReference(model, options) {
      delete this._byId[model.cid];
      const id = this.modelId(model.attributes, model.idAttribute);
      if (id != null) delete this._byId[id];
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    }

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent(event, model, collection, options) {
      if (model) {
        if ((event === 'add' || event === 'remove') && collection !== this) return;
        if (event === 'destroy') this.remove(model, options);
        if (event === 'change') {
          const prevId = this.modelId(model.previousAttributes(), model.idAttribute);
          const id = this.modelId(model.attributes, model.idAttribute);
          if (prevId !== id) {
            if (prevId != null) delete this._byId[prevId];
            if (id != null) this._byId[id] = model;
          }
        }
      }
      this.trigger.apply(this, arguments);
    }
  };

  const proto = Collection.prototype;

  Object.assign(proto, Events);

  // The default model for a collection is just a **Model**.
  // This should be overridden in most cases.
  proto.model = Model;

  // preinitialize is an empty function by default. You can override it with a function
  // or object.  preinitialize will run before any instantiation logic is run in the Collection.
  proto.preinitialize = _.noop;

  // Initialize is an empty function by default. Override it with your own
  // initialization logic.
  proto.initialize = _.noop;

  if ($$iterator) {
    proto[$$iterator] = proto.values;
  }

  // Lodash methods that we want to implement on the Collection. 90% of the core
  // usefulness of Collections is actually implemented right here:

  mixinMethods(
    Collection,
    [
      ['chain', _.chain, 1],
      ['countBy', _.countBy, 3],
      ['difference', _.difference, 0],
      ['drop', _.drop, 3],
      ['each', _.each, 3],
      ['every', _.every, 3],
      ['filter', _.filter, 3],
      ['find', _.find, 3],
      ['findIndex', _.findIndex, 3],
      ['findLastIndex', _.findLastIndex, 3],
      ['first', _.first, 3],
      ['forEach', _.forEach, 3],
      ['groupBy', _.groupBy, 3],
      ['head', _.head, 3],
      ['includes', _.includes, 3],
      ['indexOf', _.indexOf, 3],
      ['initial', _.initial, 3],
      ['invokeMap', _.invokeMap, 0],
      ['isEmpty', _.isEmpty, 1],
      ['keyBy', _.keyBy, 3],
      ['last', _.last, 3],
      ['lastIndexOf', _.lastIndexOf, 3],
      ['map', _.map, 3],
      ['max', _.max, 3],
      ['min', _.min, 3],
      ['partition', _.partition, 3],
      ['reduce', _.reduce, 0],
      ['reduceRight', _.reduceRight, 0],
      ['reject', _.reject, 3],
      ['sample', _.sample, 3],
      ['shuffle', _.shuffle, 1],
      ['size', _.size, 1],
      ['some', _.some, 3],
      ['sortBy', _.sortBy, 3],
      ['tail', _.tail, 3],
      ['take', _.take, 3],
      ['toArray', _.toArray, 1],
      ['without', _.without, 0],

      // Translated, roughly, from underscore:
      ['pairs', _.entries, 1],
    ],
    'models'
  );

  // Translated, roughly, from underscore:
  proto.all = proto.every;
  proto.any = proto.some;
  proto.collect = proto.map;
  proto.contains = proto.include = proto.includes;
  proto.detect = proto.find;
  proto.foldl = proto.inject = proto.reduce;
  proto.foldr = proto.reduceRight;
  proto.indexBy = proto.keyBy;
  proto.invoke = proto.invokeMap;
  proto.rest = proto.tail;
  proto.select = proto.filter;

  return Collection;
})();

// CollectionIterator
// ------------------

// This "enum" defines the three possible kinds of values which can be emitted
// by a CollectionIterator that correspond to the values(), keys() and entries()
// methods on Collection, respectively.
const ITERATOR_VALUES = 1;
const ITERATOR_KEYS = 2;
const ITERATOR_KEYSVALUES = 3;

// A CollectionIterator implements JavaScript's Iterator protocol, allowing the
// use of `for of` loops in modern browsers and interoperation between
// Collection and other JavaScript functions and third-party libraries which can
// operate on Iterables.
const CollectionIterator = /*#__PURE__*/ (() => {
  // eslint-disable-next-line no-shadow
  const CollectionIterator = class CollectionIterator {
    _index = 0;

    constructor(collection, kind) {
      this._collection = collection;
      this._kind = kind;
    }

    next() {
      if (this._collection) {
        // Only continue iterating if the iterated collection is long enough.
        if (this._index < this._collection.length) {
          const model = this._collection.at(this._index);
          this._index++;

          // Construct a value depending on what kind of values should be iterated.
          let value;
          if (this._kind === ITERATOR_VALUES) {
            value = model;
          } else {
            const id = this._collection.modelId(model.attributes);
            if (this._kind === ITERATOR_KEYS) {
              value = id;
            } else {
              // ITERATOR_KEYSVALUES
              value = [id, model];
            }
          }
          return { value: value, done: false };
        }

        // Once exhausted, remove the reference to the collection so future
        // calls to the next method always return done.
        this._collection = void 0;
      }

      return { value: void 0, done: true };
    }
  };

  // All Iterators should themselves be Iterable.
  if ($$iterator) {
    CollectionIterator.prototype[$$iterator] = function () {
      return this;
    };
  }

  return CollectionIterator;
})();

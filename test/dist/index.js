(function () {
'use strict';

/**
 * slice() reference.
 */

var slice = Array.prototype.slice;

/**
 * Expose `co`.
 */

var index = co['default'] = co.co = co;

/**
 * Wrap the given generator `fn` into a
 * function that returns a promise.
 * This is a separate function so that
 * every `co()` call doesn't create a new,
 * unnecessary closure.
 *
 * @param {GeneratorFunction} fn
 * @return {Function}
 * @api public
 */

co.wrap = function (fn) {
  createPromise.__generatorFunction__ = fn;
  return createPromise;
  function createPromise() {
    return co.call(this, fn.apply(this, arguments));
  }
};

/**
 * Execute the generator function or a generator
 * and return a promise.
 *
 * @param {Function} fn
 * @return {Promise}
 * @api public
 */

function co(gen) {
  var ctx = this;
  var args = slice.call(arguments, 1);

  // we wrap everything in a promise to avoid promise chaining,
  // which leads to memory leak errors.
  // see https://github.com/tj/co/issues/180
  return new Promise(function(resolve, reject) {
    if (typeof gen === 'function') gen = gen.apply(ctx, args);
    if (!gen || typeof gen.next !== 'function') return resolve(gen);

    onFulfilled();

    /**
     * @param {Mixed} res
     * @return {Promise}
     * @api private
     */

    function onFulfilled(res) {
      var ret;
      try {
        ret = gen.next(res);
      } catch (e) {
        return reject(e);
      }
      next(ret);
    }

    /**
     * @param {Error} err
     * @return {Promise}
     * @api private
     */

    function onRejected(err) {
      var ret;
      try {
        ret = gen.throw(err);
      } catch (e) {
        return reject(e);
      }
      next(ret);
    }

    /**
     * Get the next value in the generator,
     * return a promise.
     *
     * @param {Object} ret
     * @return {Promise}
     * @api private
     */

    function next(ret) {
      if (ret.done) return resolve(ret.value);
      var value = toPromise.call(ctx, ret.value);
      if (value && isPromise(value)) return value.then(onFulfilled, onRejected);
      return onRejected(new TypeError('You may only yield a function, promise, generator, array, or object, '
        + 'but the following object was passed: "' + String(ret.value) + '"'));
    }
  });
}

/**
 * Convert a `yield`ed value into a promise.
 *
 * @param {Mixed} obj
 * @return {Promise}
 * @api private
 */

function toPromise(obj) {
  if (!obj) return obj;
  if (isPromise(obj)) return obj;
  if (isGeneratorFunction(obj) || isGenerator(obj)) return co.call(this, obj);
  if ('function' == typeof obj) return thunkToPromise.call(this, obj);
  if (Array.isArray(obj)) return arrayToPromise.call(this, obj);
  if (isObject(obj)) return objectToPromise.call(this, obj);
  return obj;
}

/**
 * Convert a thunk to a promise.
 *
 * @param {Function}
 * @return {Promise}
 * @api private
 */

function thunkToPromise(fn) {
  var ctx = this;
  return new Promise(function (resolve, reject) {
    fn.call(ctx, function (err, res) {
      if (err) return reject(err);
      if (arguments.length > 2) res = slice.call(arguments, 1);
      resolve(res);
    });
  });
}

/**
 * Convert an array of "yieldables" to a promise.
 * Uses `Promise.all()` internally.
 *
 * @param {Array} obj
 * @return {Promise}
 * @api private
 */

function arrayToPromise(obj) {
  return Promise.all(obj.map(toPromise, this));
}

/**
 * Convert an object of "yieldables" to a promise.
 * Uses `Promise.all()` internally.
 *
 * @param {Object} obj
 * @return {Promise}
 * @api private
 */

function objectToPromise(obj){
  var results = new obj.constructor();
  var keys = Object.keys(obj);
  var promises = [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var promise = toPromise.call(this, obj[key]);
    if (promise && isPromise(promise)) defer(promise, key);
    else results[key] = obj[key];
  }
  return Promise.all(promises).then(function () {
    return results;
  });

  function defer(promise, key) {
    // predefine the key in the result
    results[key] = undefined;
    promises.push(promise.then(function (res) {
      results[key] = res;
    }));
  }
}

/**
 * Check if `obj` is a promise.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isPromise(obj) {
  return 'function' == typeof obj.then;
}

/**
 * Check if `obj` is a generator.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

function isGenerator(obj) {
  return 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

/**
 * Check if `obj` is a generator function.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */
function isGeneratorFunction(obj) {
  var constructor = obj.constructor;
  if (!constructor) return false;
  if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) return true;
  return isGenerator(constructor.prototype);
}

/**
 * Check for plain object.
 *
 * @param {Mixed} val
 * @return {Boolean}
 * @api private
 */

function isObject(val) {
  return Object == val.constructor;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var keys = createCommonjsModule(function (module, exports) {
exports = module.exports = typeof Object.keys === 'function'
  ? Object.keys : shim;

exports.shim = shim;
function shim (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}
});

var is_arguments = createCommonjsModule(function (module, exports) {
var supportsArgumentsClass = (function(){
  return Object.prototype.toString.call(arguments)
})() == '[object Arguments]';

exports = module.exports = supportsArgumentsClass ? supported : unsupported;

exports.supported = supported;
function supported(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

exports.unsupported = unsupported;
function unsupported(object){
  return object &&
    typeof object == 'object' &&
    typeof object.length == 'number' &&
    Object.prototype.hasOwnProperty.call(object, 'callee') &&
    !Object.prototype.propertyIsEnumerable.call(object, 'callee') ||
    false;
}
});

var index$1 = createCommonjsModule(function (module) {
var pSlice = Array.prototype.slice;
var objectKeys = keys;
var isArguments = is_arguments;

var deepEqual = module.exports = function (actual, expected, opts) {
  if (!opts) opts = {};
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!actual || !expected || typeof actual != 'object' && typeof expected != 'object') {
    return opts.strict ? actual === expected : actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected, opts);
  }
};

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isBuffer (x) {
  if (!x || typeof x !== 'object' || typeof x.length !== 'number') return false;
  if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
    return false;
  }
  if (x.length > 0 && typeof x[0] !== 'number') return false;
  return true;
}

function objEquiv(a, b, opts) {
  var i, key;
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b, opts);
  }
  if (isBuffer(a)) {
    if (!isBuffer(b)) {
      return false;
    }
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b);
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key], opts)) return false;
  }
  return typeof a === typeof b;
}
});

const assertions = {
  ok(val, message = 'should be truthy') {
    const assertionResult = {
      pass: Boolean(val),
      expected: 'truthy',
      actual: val,
      operator: 'ok',
      message
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  deepEqual(actual, expected, message = 'should be equivalent') {
    const assertionResult = {
      pass: index$1(actual, expected),
      actual,
      expected,
      message,
      operator: 'deepEqual'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  equal(actual, expected, message = 'should be equal') {
    const assertionResult = {
      pass: actual === expected,
      actual,
      expected,
      message,
      operator: 'equal'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  notOk(val, message = 'should not be truthy') {
    const assertionResult = {
      pass: !Boolean(val),
      expected: 'falsy',
      actual: val,
      operator: 'notOk',
      message
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  notDeepEqual(actual, expected, message = 'should not be equivalent') {
    const assertionResult = {
      pass: !index$1(actual, expected),
      actual,
      expected,
      message,
      operator: 'notDeepEqual'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  notEqual(actual, expected, message = 'should not be equal') {
    const assertionResult = {
      pass: actual !== expected,
      actual,
      expected,
      message,
      operator: 'notEqual'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  throws(func, expected, message) {
    let caught, pass, actual;
    if (typeof expected === 'string') {
      [expected, message] = [message, expected];
    }
    try {
      func();
    } catch (error) {
      caught = {error};
    }
    pass = caught !== undefined;
    actual = caught && caught.error;
    if (expected instanceof RegExp) {
      pass = expected.test(actual) || expected.test(actual && actual.message);
      expected = String(expected);
    } else if (typeof expected === 'function' && caught) {
      pass = actual instanceof expected;
      actual = actual.constructor;
    }
    const assertionResult = {
      pass,
      expected,
      actual,
      operator: 'throws',
      message: message || 'should throw'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  doesNotThrow(func, expected, message) {
    let caught;
    if (typeof expected === 'string') {
      [expected, message] = [message, expected];
    }
    try {
      func();
    } catch (error) {
      caught = {error};
    }
    const assertionResult = {
      pass: caught === undefined,
      expected: 'no thrown error',
      actual: caught && caught.error,
      operator: 'doesNotThrow',
      message: message || 'should not throw'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  fail(reason = 'fail called') {
    const assertionResult = {
      pass: false,
      actual: 'fail called',
      expected: 'fail not called',
      message: reason,
      operator: 'fail'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  }
};

function assertion (test) {
  return Object.create(assertions, {test: {value: test}});
}

const Test = {
  run: function () {
    const assert = assertion(this);
    const now = Date.now();
    return index(this.coroutine(assert))
      .then(() => {
        return {assertions: this.assertions, executionTime: Date.now() - now};
      });
  },
  addAssertion(){
    const newAssertions = [...arguments].map(a => Object.assign({description: this.description}, a));
    this.assertions.push(...newAssertions);
    return this;
  }
};

function test ({description, coroutine, only = false}) {
  return Object.create(Test, {
    description: {value: description},
    coroutine: {value: coroutine},
    assertions: {value: []},
    only: {value: only},
    length: {
      get(){
        return this.assertions.length
      }
    }
  });
}

function tapOut ({pass, message, index}) {
  const status = pass === true ? 'ok' : 'not ok';
  console.log([status, index, message].join(' '));
}

function canExit () {
  return typeof process !== 'undefined' && typeof process.exit === 'function';
}

function tap () {
  return function * () {
    let index = 1;
    let lastId = 0;
    let success = 0;
    let failure = 0;

    const starTime = Date.now();
    console.log('TAP version 13');
    try {
      while (true) {
        const assertion = yield;
        if (assertion.pass === true) {
          success++;
        } else {
          failure++;
        }
        assertion.index = index;
        if (assertion.id !== lastId) {
          console.log(`# ${assertion.description} - ${assertion.executionTime}ms`);
          lastId = assertion.id;
        }
        tapOut(assertion);
        if (assertion.pass !== true) {
          console.log(`  ---
  operator: ${assertion.operator}
  expected: ${JSON.stringify(assertion.expected)}
  actual: ${JSON.stringify(assertion.actual)}
  ...`);
        }
        index++;
      }
    } catch (e) {
      console.log('Bail out! unhandled exception');
      console.log(e);
      if (canExit()) {
        process.exit(1);
      }
    }
    finally {
      const execution = Date.now() - starTime;
      if (index > 1) {
        console.log(`
1..${index - 1}
# duration ${execution}ms
# success ${success}
# failure ${failure}`);
      }
      if (failure && canExit()) {
        process.exit(1);
      }
    }
  };
}

const Plan = {
  test(description, coroutine, opts = {}){
    const testItems = (!coroutine && description.tests) ? [...description] : [{description, coroutine}];
    this.tests.push(...testItems.map(t=>test(Object.assign(t, opts))));
    return this;
  },

  only(description, coroutine){
    return this.test(description, coroutine, {only: true});
  },

  run(sink = tap()){
    const sinkIterator = sink();
    sinkIterator.next();
    const hasOnly = this.tests.some(t=>t.only);
    const runnable = hasOnly ? this.tests.filter(t=>t.only) : this.tests;
    return index(function * () {
      let id = 1;
      try {
        const results = runnable.map(t=>t.run());
        for (let r of results) {
          const {assertions, executionTime} = yield r;
          for (let assert of assertions) {
            sinkIterator.next(Object.assign(assert, {id, executionTime}));
          }
          id++;
        }
      }
      catch (e) {
        sinkIterator.throw(e);
      } finally {
        sinkIterator.return();
      }
    }.bind(this))
  },

  * [Symbol.iterator](){
    for (let t of this.tests) {
      yield t;
    }
  }
};

function plan$1 () {
  return Object.create(Plan, {
    tests: {value: []},
    length: {
      get(){
        return this.tests.length
      }
    }
  });
}

function curry (fn, arityLeft) {
  const arity = arityLeft || fn.length;
  return (...args) => {
    const argLength = args.length || 1;
    if (arity === argLength) {
      return fn(...args);
    } else {
      const func = (...moreArgs) => fn(...args, ...moreArgs);
      return curry(func, arity - args.length);
    }
  };
}

function* giveMeN (n) {
  for (let i = 0; i < n; i++) {
    yield i;
  }
}

const doNTimes = curry((fn, count = 1) => {
  const n = count || 1;
  [...giveMeN(n)].forEach(() => fn());
}, 2);

var helper = plan$1()
  .test('give me n', function * (t) {
    const n = [...giveMeN(5)];
    t.deepEqual(n, [0, 1, 2, 3, 4,]);
  })
  .test('give me none', function * (t) {
    const n = [...giveMeN()];
    t.deepEqual(n, []);
  })
  .test('do n times', function * (t) {
    let counter = 0;
    doNTimes(() => counter++, 4);
    t.equal(counter, 4);
  })
  .test('do n times (curried)', function * (t) {
    let counter = 0;
    doNTimes(() => counter++)(4);
    t.equal(counter, 4);
  })
  .test('do once by default', function * (t) {
    let counter = 0;
    doNTimes(() => counter++)();
    t.equal(counter, 1);
  });

var dataSource$1 = function ({table}) {
  return {
    pull(offset, number){
      const tableState = table.getTableState();
      const {slice:{size:pageSize}} = tableState;
      const startPage = Math.floor(offset / pageSize);
      const trimBefore = offset % pageSize;
      const lastPage = Math.ceil((offset + number) / pageSize);
      const pageConfList = [...giveMeN(lastPage - startPage)].map(off => ({
        page: startPage + off + 1,
        size: pageSize
      }));
      return Promise.all(pageConfList.map(slice => {
        return table.eval(Object.assign({}, tableState, {slice}));
      }, []))
        .then(pages => {
          return pages.reduce((acc, curr) => {
            return acc.concat(curr);
          }, [])
            .filter((item, index) => index >= trimBefore)
            .slice(0, number);
        });
    }
  };
};

function swap$1 (f) {
  return (a, b) => f(b, a);
}

function compose$1 (first, ...fns) {
  return (...args) => fns.reduce((previous, current) => current(previous), first(...args));
}

function curry$1 (fn, arityLeft) {
  const arity = arityLeft || fn.length;
  return (...args) => {
    const argLength = args.length || 1;
    if (arity === argLength) {
      return fn(...args);
    } else {
      const func = (...moreArgs) => fn(...args, ...moreArgs);
      return curry$1(func, arity - args.length);
    }
  };
}



function tap$2 (fn) {
  return arg => {
    fn(arg);
    return arg;
  }
}

function pointer (path) {

  const parts = path.split('.');

  function partial (obj = {}, parts = []) {
    const p = parts.shift();
    const current = obj[p];
    return (current === undefined || parts.length === 0) ?
      current : partial(current, parts);
  }

  function set (target, newTree) {
    let current = target;
    const [leaf, ...intermediate] = parts.reverse();
    for (let key of intermediate.reverse()) {
      if (current[key] === undefined) {
        current[key] = {};
        current = current[key];
      }
    }
    current[leaf] = Object.assign(current[leaf] || {}, newTree);
    return target;
  }

  return {
    get(target){
      return partial(target, [...parts])
    },
    set
  }
}

function sortByProperty (prop) {
  const propGetter = pointer(prop).get;
  return (a, b) => {
    const aVal = propGetter(a);
    const bVal = propGetter(b);

    if (aVal === bVal) {
      return 0;
    }

    if (bVal === undefined) {
      return -1;
    }

    if (aVal === undefined) {
      return 1;
    }

    return aVal < bVal ? -1 : 1;
  }
}

function sortFactory ({pointer: pointer$$1, direction} = {}) {
  if (!pointer$$1 || direction === 'none') {
    return array => [...array];
  }

  const orderFunc = sortByProperty(pointer$$1);
  const compareFunc = direction === 'desc' ? swap$1(orderFunc) : orderFunc;

  return (array) => [...array].sort(compareFunc);
}

function typeExpression (type) {
  switch (type) {
    case 'boolean':
      return Boolean;
    case 'number':
      return Number;
    case 'date':
      return (val) => new Date(val);
    default:
      return compose$1(String, (val) => val.toLowerCase());
  }
}

const operators = {
  includes(value){
    return (input) => input.includes(value);
  },
  is(value){
    return (input) => Object.is(value, input);
  },
  isNot(value){
    return (input) => !Object.is(value, input);
  },
  lt(value){
    return (input) => input < value;
  },
  gt(value){
    return (input) => input > value;
  },
  lte(value){
    return (input) => input <= value;
  },
  gte(value){
    return (input) => input >= value;
  },
  equals(value){
    return (input) => value == input;
  },
  notEquals(value){
    return (input) => value != input;
  }
};

const every = fns => (...args) => fns.every(fn => fn(...args));

function predicate ({value = '', operator = 'includes', type = 'string'}) {
  const typeIt = typeExpression(type);
  const operateOnTyped = compose$1(typeIt, operators[operator]);
  const predicateFunc = operateOnTyped(value);
  return compose$1(typeIt, predicateFunc);
}

//avoid useless filter lookup (improve perf)
function normalizeClauses (conf) {
  const output = {};
  const validPath = Object.keys(conf).filter(path => Array.isArray(conf[path]));
  validPath.forEach(path => {
    const validClauses = conf[path].filter(c => c.value !== '');
    if (validClauses.length) {
      output[path] = validClauses;
    }
  });
  return output;
}

function filter$1 (filter) {
  const normalizedClauses = normalizeClauses(filter);
  const funcList = Object.keys(normalizedClauses).map(path => {
    const getter = pointer(path).get;
    const clauses = normalizedClauses[path].map(predicate);
    return compose$1(getter, every(clauses));
  });
  const filterPredicate = every(funcList);

  return (array) => array.filter(filterPredicate);
}

var search$1 = function (searchConf = {}) {
  const {value, scope = []} = searchConf;
  const searchPointers = scope.map(field => pointer(field).get);
  if (!scope.length || !value) {
    return array => array;
  } else {
    return array => array.filter(item => searchPointers.some(p => String(p(item)).includes(String(value))))
  }
};

function sliceFactory ({page = 1, size} = {}) {
  return function sliceFunction (array = []) {
    const actualSize = size || array.length;
    const offset = (page - 1) * actualSize;
    return array.slice(offset, offset + actualSize);
  };
}

function emitter () {

  const listenersLists = {};

  return {
    on(event, ...listeners){
      listenersLists[event] = (listenersLists[event] || []).concat(listeners);
      return this;
    },
    dispatch(event, ...args){
      const listeners = listenersLists[event] || [];
      for (let listener of listeners) {
        listener(...args);
      }
      return this;
    },
    off(event, ...listeners){
      if (!event) {
        Object.keys(listenersLists).forEach(ev => this.off(ev));
      } else {
        const list = listenersLists[event] || [];
        listenersLists[event] = listeners.length ? list.filter(listener => !listeners.includes(listener)) : [];
      }
      return this;
    }
  }
}

const TOGGLE_SORT = 'TOGGLE_SORT';
const DISPLAY_CHANGED = 'DISPLAY_CHANGED';
const PAGE_CHANGED = 'CHANGE_PAGE';
const EXEC_CHANGED = 'EXEC_STARTED';
const FILTER_CHANGED = 'FILTER_CHANGED';
const SUMMARY_CHANGED = 'SUMMARY_CHANGED';
const SEARCH_CHANGED = 'SEARCH_CHANGED';
const EXEC_ERROR = 'EXEC_ERROR';

function curriedPointer (path) {
  const {get, set} = pointer(path);
  return {get, set: curry$1(set)};
}

var table$1 = function ({
  sortFactory,
  tableState,
  data,
  filterFactory,
  searchFactory
}) {
  const table = emitter();
  const sortPointer = curriedPointer('sort');
  const slicePointer = curriedPointer('slice');
  const filterPointer = curriedPointer('filter');
  const searchPointer = curriedPointer('search');

  const safeAssign = curry$1((base, extension) => Object.assign({}, base, extension));
  const dispatch = curry$1(table.dispatch.bind(table), 2);

  const createSummary = (filtered) => {
    dispatch(SUMMARY_CHANGED, {
      page: tableState.slice.page,
      size: tableState.slice.size,
      filteredCount: filtered.length
    });
  };

  const exec = ({processingDelay = 20} = {}) => {
    table.dispatch(EXEC_CHANGED, {working: true});
    setTimeout(function () {
      try {
        const filterFunc = filterFactory(filterPointer.get(tableState));
        const searchFunc = searchFactory(searchPointer.get(tableState));
        const sortFunc = sortFactory(sortPointer.get(tableState));
        const sliceFunc = sliceFactory(slicePointer.get(tableState));
        const execFunc = compose$1(filterFunc, searchFunc, tap$2(createSummary), sortFunc, sliceFunc);
        const displayed = execFunc(data);
        table.dispatch(DISPLAY_CHANGED, displayed.map(d => {
          return {index: data.indexOf(d), value: d};
        }));
      } catch (e) {
        table.dispatch(EXEC_ERROR, e);
      } finally {
        table.dispatch(EXEC_CHANGED, {working: false});
      }
    }, processingDelay);
  };

  const updateTableState = curry$1((pter, ev, newPartialState) => compose$1(
    safeAssign(pter.get(tableState)),
    tap$2(dispatch(ev)),
    pter.set(tableState)
  )(newPartialState));

  const resetToFirstPage = () => updateTableState(slicePointer, PAGE_CHANGED, {page: 1});

  const tableOperation = (pter, ev) => compose$1(
    updateTableState(pter, ev),
    resetToFirstPage,
    () => table.exec() // we wrap within a function so table.exec can be overwritten (when using with a server for example)
  );

  const api = {
    sort: tableOperation(sortPointer, TOGGLE_SORT),
    filter: tableOperation(filterPointer, FILTER_CHANGED),
    search: tableOperation(searchPointer, SEARCH_CHANGED),
    slice: compose$1(updateTableState(slicePointer, PAGE_CHANGED), () => table.exec()),
    exec,
    eval(state = tableState){
      return Promise.resolve()
        .then(function () {
          const sortFunc = sortFactory(sortPointer.get(state));
          const searchFunc = searchFactory(searchPointer.get(state));
          const filterFunc = filterFactory(filterPointer.get(state));
          const sliceFunc = sliceFactory(slicePointer.get(state));
          const execFunc = compose$1(filterFunc, searchFunc, sortFunc, sliceFunc);
          return execFunc(data).map(d => {
            return {index: data.indexOf(d), value: d}
          });
        });
    },
    onDisplayChange(fn){
      table.on(DISPLAY_CHANGED, fn);
    },
    getTableState(){
      return Object.assign({}, tableState)
    }
  };

  return Object.assign(table, api);
};

var table = function ({
  sortFactory: sortFactory$$1 = sortFactory,
  filterFactory = filter$1,
  searchFactory = search$1,
  tableState = {sort: {}, slice: {page: 1}, filter: {}, search: {}},
  data = []
}, ...tableDirectives) {

  const coreTable = table$1({sortFactory: sortFactory$$1, filterFactory, tableState, data, searchFactory});

  return tableDirectives.reduce((accumulator, newdir) => {
    return Object.assign(accumulator, newdir({
      sortFactory: sortFactory$$1,
      filterFactory,
      searchFactory,
      tableState,
      data,
      table: coreTable
    }));
  }, coreTable);
};

const dataSet = [
  {id: 1},
  {id: 2},
  {id: 3},
  {id: 4},
  {id: 5},
  {id: 6},
  {id: 7},
  {id: 8}
];
const initialTableState = {
  search: {},
  filter: {},
  sort: {},
  slice: {size: 2, page: 1}
};

var dataSource = plan$1()
  .test('pull data from data source from an offset to a given number based on the page size conf', function * (t) {
    const table$$1 = table({data: dataSet, tableState: initialTableState});
    const data = dataSource$1({table: table$$1});
    const items = yield data.pull(1, 4);
    t.deepEqual(items, [
      {index: 1, value: {id: 2}},
      {index: 2, value: {id: 3}},
      {index: 3, value: {id: 4}},
      {index: 4, value: {id: 5}}
    ]);
  });

var buffer$1 = function ({bufferSize = 1000, windowSize = 200} = {}) {

  const dataList = [];
  let windowCursor = null;

  const instance = {
    push(){
      const items = [...arguments];
      const maxRemovableItemCount = Math.min(dataList.indexOf(windowCursor), items.length);
      const limit = dataList.length < bufferSize ? bufferSize - dataList.length : maxRemovableItemCount;
      const toAppend = items.slice(0, limit);
      const tailItem = instance.tail();
      const startIndex = tailItem ? tailItem.$$index + 1 : 0;
      dataList.push(...toAppend.map((item, offset) => Object.assign({$$index: startIndex + offset}, item)));
      if (dataList.length > bufferSize) {
        const toDrop = dataList.splice(0, limit);
        toDrop.forEach(item => {
          if (item.clean) {
            item.clean();
          }
        });
      }
    },
    unshift(){
      const items = [...arguments];
      const upperWindowIndex = Math.min(dataList.indexOf(windowCursor) + windowSize, dataList.length - 1);
      const maxRemovableItemCount = Math.min(dataList.length - upperWindowIndex, items.length);
      const limit = dataList.length < bufferSize ? bufferSize - dataList.length : maxRemovableItemCount;
      const toPrepend = items.slice(0, limit);
      const startIndex = instance.head().$$index - limit;
      dataList.unshift(...toPrepend.map((item, offset) => Object.assign({$$index: startIndex + offset}, item)));
      if (dataList.length > bufferSize) {
        const toDrop = dataList.splice(-limit);
        toDrop.forEach(item => {
          if (item.clean) {
            item.clean();
          }
        });
      }
    },
    get(index){
      return dataList.find(item => item.$$index === index);
    },
    head(){
      return dataList[0] || null;
    },
    tail(){
      return dataList.length ? dataList[dataList.length - 1] : null;
    },
    slide(offset){
      const cursorIndex = windowCursor !== null ? dataList.indexOf(windowCursor) : 0;
      const index = Math.max(cursorIndex + offset, 0);
      const start = index + windowSize >= (bufferSize - 1) ? bufferSize - windowSize : index;
      const slice = dataList.slice(start, start + windowSize);
      const shift = start - cursorIndex;
      windowCursor = dataList[start];
      return {slice, shift};
    },
    position(){
      return (dataList.indexOf(windowCursor) + 1) / (bufferSize - windowSize);
    }
  };

  Object.defineProperty(instance, 'length', {
    get(){
      return dataList.length;
    }
  });

  return instance;
};

const itemFactory = () => {

  let cleanedCount = 0;

  const factory = (item) => Object.assign({
    clean(){
      cleanedCount++;
    }
  }, item);

  Object.defineProperty(factory, 'cleaned', {
    get(){
      return cleanedCount
    }
  });

  return factory;
};

var buffer = plan$1()
  .test('push multiple items', function * (t) {
    const factory = itemFactory();
    const b = buffer$1({bufferSize: 100, windowSize: 20});
    const items = [233, 455].map(id => factory({id}));
    b.push(...items);
    b.slide(0);
    t.equal(b.length, 2);
    items.forEach((item, index) => {
      const actual = b.get(index);
      const expected = items[index];
      t.equal(actual.$$index, index);
      t.equal(actual.id, expected.id);
    });
    b.push(factory({id: 22}));
    t.equal(b.get(2).id, 22);
  })
  .test('shift extra item when push exceed capacity', function * (t) {
    const factory = itemFactory();
    const b = buffer$1({bufferSize: 100, windowSize: 20});
    const items = [...giveMeN(100)].map((id) => ({id}));
    b.push(...items.map(factory));
    b.slide(5);
    t.equal(b.length, 100);
    b.push({id: 666});
    t.equal(b.length, 100);
    t.equal(b.tail().id, 666);
    t.equal(b.head().id, 1);
    t.equal(factory.cleaned, 1);
  })
  .test('shift items keeping window cursor constraint', function * (t) {
    const b = buffer$1({bufferSize: 100, windowSize: 20});
    const factory = itemFactory();
    const items = [...giveMeN(100)].map((id) => ({id}));
    b.push(...items.map(factory));
    b.slide(4);
    t.equal(b.length, 100);
    const newItems = [...giveMeN(10)].map(id => ({id: 600 + id}));
    b.push(...newItems);
    t.equal(b.length, 100);
    t.equal(b.tail().id, 603);
    t.equal(b.head().id, 4);
    t.equal(factory.cleaned, 4);
  })
  .test('move window up maximum to fit into buffer', function * (t) {
    const factory = itemFactory();
    const b = buffer$1({bufferSize: 100, windowSize: 20});
    const items = [...giveMeN(100)].map((id) => ({id}));
    b.push(...items.map(factory));
    const {slice, shift} = b.slide(90);
    t.equal(slice.length, 20);
    t.equal(slice[19].id, 99);
    t.equal(slice[0].id, 80);
    t.equal(shift, 80);
  })
  .test('move window down maximum to fit into buffer', function * (t) {
    const factory = itemFactory();
    const b = buffer$1({bufferSize: 100, windowSize: 20});
    const items = [...giveMeN(100)].map((id) => ({id}));
    b.push(...items.map(factory));
    const {slice, shift} = b.slide(50);
    t.equal(slice[19].id, 69);
    t.equal(slice[0].id, 50);
    t.equal(shift, 50);
    const {slice:sl, shift:sh} = b.slide(-100);
    t.equal(sl.length, 20);
    t.equal(sl[0].id, 0);
    t.equal(sl[19].id, 19);
    t.equal(sh, -50);
  });

var container$1 = function ({element, windowSize}) {

  const instance = {
    append(...args){
      for (let item of args) {
        element.appendChild(item);
        if (instance.length > windowSize) {
          instance.dropBegin(instance.length - windowSize);
        }
      }
    },
    prepend(...args){
      for (let item of args) {
        element.insertBefore(item, element.firstChild);
        if (instance.length > windowSize) {
          instance.dropEnd(instance.length - windowSize);
        }
      }
    },
    dropBegin: doNTimes(() => {
      const firstChild = element.firstChild;
      if (firstChild) {
        firstChild.remove();
      }
    }),
    dropEnd: doNTimes(() => {
      const lastChild = element.lastChild;
      if (lastChild) {
        lastChild.remove();
      }
    }),
    empty(){
      element.innerHTML = '';
    }
  };

  Object.defineProperty(instance, 'length', {
    get(){
      return element.children.length;
    }
  });

  return instance;
};

function getElement () {
  return document.createElement('ul');
}

function li (id) {
  const l = document.createElement('li');
  l.id = id;
  return l;
}

function testElement (el, expected, assert) {
  const children = Array.from(el.children);
  children.forEach((child, index) => {
    assert.equal(child.id, expected[index].toString());
  });
}

var container = plan$1()
  .test('append n elements after', function * (t) {
    const element = getElement();
    const c = container$1({element, windowSize: 5});
    c.append(li(0));
    testElement(element, [0], t);
    c.append(...[1, 2, 3, 4].map(li));
    testElement(element, [0, 1, 2, 3, 4], t);
  })
  .test('append: drop element if over window size', function * (t) {
    const element = getElement();
    const c = container$1({element, windowSize: 5});
    c.append(li(0));
    testElement(element, [0], t);
    c.append(...[1, 2, 3, 4, 5, 6].map(li));
    testElement(element, [2, 3, 4, 5, 6], t);
  })
  .test('prepend n elements before', function * (t) {
    const element = getElement();
    const c = container$1({element, windowSize: 5});
    c.append(li(0));
    testElement(element, [0], t);
    c.prepend(...[4, 3, 2, 1].map(li));
    testElement(element, [1, 2, 3, 4, 0], t);
  })
  .test('prepend: drop element if over window size', function * (t) {
    const element = getElement();
    const c = container$1({element, windowSize: 5});
    c.append(li(0));
    testElement(element, [0], t);
    c.prepend(...[6, 5, 4, 3, 2, 1].map(li));
    testElement(element, [1, 2, 3, 4, 5], t);
  });

plan$1()
  .test(helper)
  .test(buffer)
  .test(dataSource)
  .test(container)
  .run();

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uLy4uL25vZGVfbW9kdWxlcy96b3JhL2Rpc3Qvem9yYS5lcy5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1vcGVyYXRvcnMvaW5kZXguanMiLCIuLi8uLi9saWIvaGVscGVyLmpzIiwiLi4vaGVscGVyLmpzIiwiLi4vLi4vbGliL2RhdGFTb3VyY2UuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlci9pbmRleC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zb3J0L2luZGV4LmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWZpbHRlci9pbmRleC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zZWFyY2gvaW5kZXguanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvc2xpY2UuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZXZlbnRzL2luZGV4LmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2V2ZW50cy5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3RhYmxlLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3RhYmxlLmpzIiwiLi4vZGF0YVNvdXJjZS5qcyIsIi4uLy4uL2xpYi9idWZmZXJlZFdpbmRvdy5qcyIsIi4uL2l0ZW1zQnVmZmVyLmpzIiwiLi4vLi4vbGliL2NvbnRhaW5lci5qcyIsIi4uL2NvbnRhaW5lci5qcyIsIi4uL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogc2xpY2UoKSByZWZlcmVuY2UuXG4gKi9cblxudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG4vKipcbiAqIEV4cG9zZSBgY29gLlxuICovXG5cbnZhciBpbmRleCA9IGNvWydkZWZhdWx0J10gPSBjby5jbyA9IGNvO1xuXG4vKipcbiAqIFdyYXAgdGhlIGdpdmVuIGdlbmVyYXRvciBgZm5gIGludG8gYVxuICogZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgcHJvbWlzZS5cbiAqIFRoaXMgaXMgYSBzZXBhcmF0ZSBmdW5jdGlvbiBzbyB0aGF0XG4gKiBldmVyeSBgY28oKWAgY2FsbCBkb2Vzbid0IGNyZWF0ZSBhIG5ldyxcbiAqIHVubmVjZXNzYXJ5IGNsb3N1cmUuXG4gKlxuICogQHBhcmFtIHtHZW5lcmF0b3JGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5jby53cmFwID0gZnVuY3Rpb24gKGZuKSB7XG4gIGNyZWF0ZVByb21pc2UuX19nZW5lcmF0b3JGdW5jdGlvbl9fID0gZm47XG4gIHJldHVybiBjcmVhdGVQcm9taXNlO1xuICBmdW5jdGlvbiBjcmVhdGVQcm9taXNlKCkge1xuICAgIHJldHVybiBjby5jYWxsKHRoaXMsIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykpO1xuICB9XG59O1xuXG4vKipcbiAqIEV4ZWN1dGUgdGhlIGdlbmVyYXRvciBmdW5jdGlvbiBvciBhIGdlbmVyYXRvclxuICogYW5kIHJldHVybiBhIHByb21pc2UuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGNvKGdlbikge1xuICB2YXIgY3R4ID0gdGhpcztcbiAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgLy8gd2Ugd3JhcCBldmVyeXRoaW5nIGluIGEgcHJvbWlzZSB0byBhdm9pZCBwcm9taXNlIGNoYWluaW5nLFxuICAvLyB3aGljaCBsZWFkcyB0byBtZW1vcnkgbGVhayBlcnJvcnMuXG4gIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vdGovY28vaXNzdWVzLzE4MFxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgaWYgKHR5cGVvZiBnZW4gPT09ICdmdW5jdGlvbicpIGdlbiA9IGdlbi5hcHBseShjdHgsIGFyZ3MpO1xuICAgIGlmICghZ2VuIHx8IHR5cGVvZiBnZW4ubmV4dCAhPT0gJ2Z1bmN0aW9uJykgcmV0dXJuIHJlc29sdmUoZ2VuKTtcblxuICAgIG9uRnVsZmlsbGVkKCk7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge01peGVkfSByZXNcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfVxuICAgICAqIEBhcGkgcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gb25GdWxmaWxsZWQocmVzKSB7XG4gICAgICB2YXIgcmV0O1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0ID0gZ2VuLm5leHQocmVzKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICAgIG5leHQocmV0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Vycm9yfSBlcnJcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfVxuICAgICAqIEBhcGkgcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gb25SZWplY3RlZChlcnIpIHtcbiAgICAgIHZhciByZXQ7XG4gICAgICB0cnkge1xuICAgICAgICByZXQgPSBnZW4udGhyb3coZXJyKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICAgIG5leHQocmV0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIG5leHQgdmFsdWUgaW4gdGhlIGdlbmVyYXRvcixcbiAgICAgKiByZXR1cm4gYSBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJldFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAgICogQGFwaSBwcml2YXRlXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBuZXh0KHJldCkge1xuICAgICAgaWYgKHJldC5kb25lKSByZXR1cm4gcmVzb2x2ZShyZXQudmFsdWUpO1xuICAgICAgdmFyIHZhbHVlID0gdG9Qcm9taXNlLmNhbGwoY3R4LCByZXQudmFsdWUpO1xuICAgICAgaWYgKHZhbHVlICYmIGlzUHJvbWlzZSh2YWx1ZSkpIHJldHVybiB2YWx1ZS50aGVuKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKTtcbiAgICAgIHJldHVybiBvblJlamVjdGVkKG5ldyBUeXBlRXJyb3IoJ1lvdSBtYXkgb25seSB5aWVsZCBhIGZ1bmN0aW9uLCBwcm9taXNlLCBnZW5lcmF0b3IsIGFycmF5LCBvciBvYmplY3QsICdcbiAgICAgICAgKyAnYnV0IHRoZSBmb2xsb3dpbmcgb2JqZWN0IHdhcyBwYXNzZWQ6IFwiJyArIFN0cmluZyhyZXQudmFsdWUpICsgJ1wiJykpO1xuICAgIH1cbiAgfSk7XG59XG5cbi8qKlxuICogQ29udmVydCBhIGB5aWVsZGBlZCB2YWx1ZSBpbnRvIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmpcbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiB0b1Byb21pc2Uob2JqKSB7XG4gIGlmICghb2JqKSByZXR1cm4gb2JqO1xuICBpZiAoaXNQcm9taXNlKG9iaikpIHJldHVybiBvYmo7XG4gIGlmIChpc0dlbmVyYXRvckZ1bmN0aW9uKG9iaikgfHwgaXNHZW5lcmF0b3Iob2JqKSkgcmV0dXJuIGNvLmNhbGwodGhpcywgb2JqKTtcbiAgaWYgKCdmdW5jdGlvbicgPT0gdHlwZW9mIG9iaikgcmV0dXJuIHRodW5rVG9Qcm9taXNlLmNhbGwodGhpcywgb2JqKTtcbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkgcmV0dXJuIGFycmF5VG9Qcm9taXNlLmNhbGwodGhpcywgb2JqKTtcbiAgaWYgKGlzT2JqZWN0KG9iaikpIHJldHVybiBvYmplY3RUb1Byb21pc2UuY2FsbCh0aGlzLCBvYmopO1xuICByZXR1cm4gb2JqO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYSB0aHVuayB0byBhIHByb21pc2UuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn1cbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiB0aHVua1RvUHJvbWlzZShmbikge1xuICB2YXIgY3R4ID0gdGhpcztcbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICBmbi5jYWxsKGN0eCwgZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICBpZiAoZXJyKSByZXR1cm4gcmVqZWN0KGVycik7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDIpIHJlcyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgIHJlc29sdmUocmVzKTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbi8qKlxuICogQ29udmVydCBhbiBhcnJheSBvZiBcInlpZWxkYWJsZXNcIiB0byBhIHByb21pc2UuXG4gKiBVc2VzIGBQcm9taXNlLmFsbCgpYCBpbnRlcm5hbGx5LlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IG9ialxuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGFycmF5VG9Qcm9taXNlKG9iaikge1xuICByZXR1cm4gUHJvbWlzZS5hbGwob2JqLm1hcCh0b1Byb21pc2UsIHRoaXMpKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGFuIG9iamVjdCBvZiBcInlpZWxkYWJsZXNcIiB0byBhIHByb21pc2UuXG4gKiBVc2VzIGBQcm9taXNlLmFsbCgpYCBpbnRlcm5hbGx5LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBvYmplY3RUb1Byb21pc2Uob2JqKXtcbiAgdmFyIHJlc3VsdHMgPSBuZXcgb2JqLmNvbnN0cnVjdG9yKCk7XG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgdmFyIHByb21pc2VzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgIHZhciBwcm9taXNlID0gdG9Qcm9taXNlLmNhbGwodGhpcywgb2JqW2tleV0pO1xuICAgIGlmIChwcm9taXNlICYmIGlzUHJvbWlzZShwcm9taXNlKSkgZGVmZXIocHJvbWlzZSwga2V5KTtcbiAgICBlbHNlIHJlc3VsdHNba2V5XSA9IG9ialtrZXldO1xuICB9XG4gIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGRlZmVyKHByb21pc2UsIGtleSkge1xuICAgIC8vIHByZWRlZmluZSB0aGUga2V5IGluIHRoZSByZXN1bHRcbiAgICByZXN1bHRzW2tleV0gPSB1bmRlZmluZWQ7XG4gICAgcHJvbWlzZXMucHVzaChwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHJlcykge1xuICAgICAgcmVzdWx0c1trZXldID0gcmVzO1xuICAgIH0pKTtcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrIGlmIGBvYmpgIGlzIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gaXNQcm9taXNlKG9iaikge1xuICByZXR1cm4gJ2Z1bmN0aW9uJyA9PSB0eXBlb2Ygb2JqLnRoZW47XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYG9iamAgaXMgYSBnZW5lcmF0b3IuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gb2JqXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gaXNHZW5lcmF0b3Iob2JqKSB7XG4gIHJldHVybiAnZnVuY3Rpb24nID09IHR5cGVvZiBvYmoubmV4dCAmJiAnZnVuY3Rpb24nID09IHR5cGVvZiBvYmoudGhyb3c7XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYG9iamAgaXMgYSBnZW5lcmF0b3IgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gb2JqXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGlzR2VuZXJhdG9yRnVuY3Rpb24ob2JqKSB7XG4gIHZhciBjb25zdHJ1Y3RvciA9IG9iai5jb25zdHJ1Y3RvcjtcbiAgaWYgKCFjb25zdHJ1Y3RvcikgcmV0dXJuIGZhbHNlO1xuICBpZiAoJ0dlbmVyYXRvckZ1bmN0aW9uJyA9PT0gY29uc3RydWN0b3IubmFtZSB8fCAnR2VuZXJhdG9yRnVuY3Rpb24nID09PSBjb25zdHJ1Y3Rvci5kaXNwbGF5TmFtZSkgcmV0dXJuIHRydWU7XG4gIHJldHVybiBpc0dlbmVyYXRvcihjb25zdHJ1Y3Rvci5wcm90b3R5cGUpO1xufVxuXG4vKipcbiAqIENoZWNrIGZvciBwbGFpbiBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gaXNPYmplY3QodmFsKSB7XG4gIHJldHVybiBPYmplY3QgPT0gdmFsLmNvbnN0cnVjdG9yO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDb21tb25qc01vZHVsZShmbiwgbW9kdWxlKSB7XG5cdHJldHVybiBtb2R1bGUgPSB7IGV4cG9ydHM6IHt9IH0sIGZuKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMpLCBtb2R1bGUuZXhwb3J0cztcbn1cblxudmFyIGtleXMgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSB0eXBlb2YgT2JqZWN0LmtleXMgPT09ICdmdW5jdGlvbidcbiAgPyBPYmplY3Qua2V5cyA6IHNoaW07XG5cbmV4cG9ydHMuc2hpbSA9IHNoaW07XG5mdW5jdGlvbiBzaGltIChvYmopIHtcbiAgdmFyIGtleXMgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iaikga2V5cy5wdXNoKGtleSk7XG4gIHJldHVybiBrZXlzO1xufVxufSk7XG5cbnZhciBpc19hcmd1bWVudHMgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG52YXIgc3VwcG9ydHNBcmd1bWVudHNDbGFzcyA9IChmdW5jdGlvbigpe1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFyZ3VtZW50cylcbn0pKCkgPT0gJ1tvYmplY3QgQXJndW1lbnRzXSc7XG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHN1cHBvcnRzQXJndW1lbnRzQ2xhc3MgPyBzdXBwb3J0ZWQgOiB1bnN1cHBvcnRlZDtcblxuZXhwb3J0cy5zdXBwb3J0ZWQgPSBzdXBwb3J0ZWQ7XG5mdW5jdGlvbiBzdXBwb3J0ZWQob2JqZWN0KSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PSAnW29iamVjdCBBcmd1bWVudHNdJztcbn1cblxuZXhwb3J0cy51bnN1cHBvcnRlZCA9IHVuc3VwcG9ydGVkO1xuZnVuY3Rpb24gdW5zdXBwb3J0ZWQob2JqZWN0KXtcbiAgcmV0dXJuIG9iamVjdCAmJlxuICAgIHR5cGVvZiBvYmplY3QgPT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2Ygb2JqZWN0Lmxlbmd0aCA9PSAnbnVtYmVyJyAmJlxuICAgIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsICdjYWxsZWUnKSAmJlxuICAgICFPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwob2JqZWN0LCAnY2FsbGVlJykgfHxcbiAgICBmYWxzZTtcbn1cbn0pO1xuXG52YXIgaW5kZXgkMSA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUpIHtcbnZhciBwU2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgb2JqZWN0S2V5cyA9IGtleXM7XG52YXIgaXNBcmd1bWVudHMgPSBpc19hcmd1bWVudHM7XG5cbnZhciBkZWVwRXF1YWwgPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvcHRzKSB7XG4gIGlmICghb3B0cykgb3B0cyA9IHt9O1xuICAvLyA3LjEuIEFsbCBpZGVudGljYWwgdmFsdWVzIGFyZSBlcXVpdmFsZW50LCBhcyBkZXRlcm1pbmVkIGJ5ID09PS5cbiAgaWYgKGFjdHVhbCA9PT0gZXhwZWN0ZWQpIHtcbiAgICByZXR1cm4gdHJ1ZTtcblxuICB9IGVsc2UgaWYgKGFjdHVhbCBpbnN0YW5jZW9mIERhdGUgJiYgZXhwZWN0ZWQgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgcmV0dXJuIGFjdHVhbC5nZXRUaW1lKCkgPT09IGV4cGVjdGVkLmdldFRpbWUoKTtcblxuICAvLyA3LjMuIE90aGVyIHBhaXJzIHRoYXQgZG8gbm90IGJvdGggcGFzcyB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcsXG4gIC8vIGVxdWl2YWxlbmNlIGlzIGRldGVybWluZWQgYnkgPT0uXG4gIH0gZWxzZSBpZiAoIWFjdHVhbCB8fCAhZXhwZWN0ZWQgfHwgdHlwZW9mIGFjdHVhbCAhPSAnb2JqZWN0JyAmJiB0eXBlb2YgZXhwZWN0ZWQgIT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gb3B0cy5zdHJpY3QgPyBhY3R1YWwgPT09IGV4cGVjdGVkIDogYWN0dWFsID09IGV4cGVjdGVkO1xuXG4gIC8vIDcuNC4gRm9yIGFsbCBvdGhlciBPYmplY3QgcGFpcnMsIGluY2x1ZGluZyBBcnJheSBvYmplY3RzLCBlcXVpdmFsZW5jZSBpc1xuICAvLyBkZXRlcm1pbmVkIGJ5IGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoYXMgdmVyaWZpZWRcbiAgLy8gd2l0aCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwpLCB0aGUgc2FtZSBzZXQgb2Yga2V5c1xuICAvLyAoYWx0aG91Z2ggbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIG9yZGVyKSwgZXF1aXZhbGVudCB2YWx1ZXMgZm9yIGV2ZXJ5XG4gIC8vIGNvcnJlc3BvbmRpbmcga2V5LCBhbmQgYW4gaWRlbnRpY2FsICdwcm90b3R5cGUnIHByb3BlcnR5LiBOb3RlOiB0aGlzXG4gIC8vIGFjY291bnRzIGZvciBib3RoIG5hbWVkIGFuZCBpbmRleGVkIHByb3BlcnRpZXMgb24gQXJyYXlzLlxuICB9IGVsc2Uge1xuICAgIHJldHVybiBvYmpFcXVpdihhY3R1YWwsIGV4cGVjdGVkLCBvcHRzKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gaXNVbmRlZmluZWRPck51bGwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGlzQnVmZmVyICh4KSB7XG4gIGlmICgheCB8fCB0eXBlb2YgeCAhPT0gJ29iamVjdCcgfHwgdHlwZW9mIHgubGVuZ3RoICE9PSAnbnVtYmVyJykgcmV0dXJuIGZhbHNlO1xuICBpZiAodHlwZW9mIHguY29weSAhPT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgeC5zbGljZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoeC5sZW5ndGggPiAwICYmIHR5cGVvZiB4WzBdICE9PSAnbnVtYmVyJykgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gb2JqRXF1aXYoYSwgYiwgb3B0cykge1xuICB2YXIgaSwga2V5O1xuICBpZiAoaXNVbmRlZmluZWRPck51bGwoYSkgfHwgaXNVbmRlZmluZWRPck51bGwoYikpXG4gICAgcmV0dXJuIGZhbHNlO1xuICAvLyBhbiBpZGVudGljYWwgJ3Byb3RvdHlwZScgcHJvcGVydHkuXG4gIGlmIChhLnByb3RvdHlwZSAhPT0gYi5wcm90b3R5cGUpIHJldHVybiBmYWxzZTtcbiAgLy9+fn5JJ3ZlIG1hbmFnZWQgdG8gYnJlYWsgT2JqZWN0LmtleXMgdGhyb3VnaCBzY3Jld3kgYXJndW1lbnRzIHBhc3NpbmcuXG4gIC8vICAgQ29udmVydGluZyB0byBhcnJheSBzb2x2ZXMgdGhlIHByb2JsZW0uXG4gIGlmIChpc0FyZ3VtZW50cyhhKSkge1xuICAgIGlmICghaXNBcmd1bWVudHMoYikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgYSA9IHBTbGljZS5jYWxsKGEpO1xuICAgIGIgPSBwU2xpY2UuY2FsbChiKTtcbiAgICByZXR1cm4gZGVlcEVxdWFsKGEsIGIsIG9wdHMpO1xuICB9XG4gIGlmIChpc0J1ZmZlcihhKSkge1xuICAgIGlmICghaXNCdWZmZXIoYikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuICAgIGZvciAoaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYVtpXSAhPT0gYltpXSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB0cnkge1xuICAgIHZhciBrYSA9IG9iamVjdEtleXMoYSksXG4gICAgICAgIGtiID0gb2JqZWN0S2V5cyhiKTtcbiAgfSBjYXRjaCAoZSkgey8vaGFwcGVucyB3aGVuIG9uZSBpcyBhIHN0cmluZyBsaXRlcmFsIGFuZCB0aGUgb3RoZXIgaXNuJ3RcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy8gaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChrZXlzIGluY29ycG9yYXRlc1xuICAvLyBoYXNPd25Qcm9wZXJ0eSlcbiAgaWYgKGthLmxlbmd0aCAhPSBrYi5sZW5ndGgpXG4gICAgcmV0dXJuIGZhbHNlO1xuICAvL3RoZSBzYW1lIHNldCBvZiBrZXlzIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLFxuICBrYS5zb3J0KCk7XG4gIGtiLnNvcnQoKTtcbiAgLy9+fn5jaGVhcCBrZXkgdGVzdFxuICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGlmIChrYVtpXSAhPSBrYltpXSlcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICAvL2VxdWl2YWxlbnQgdmFsdWVzIGZvciBldmVyeSBjb3JyZXNwb25kaW5nIGtleSwgYW5kXG4gIC8vfn5+cG9zc2libHkgZXhwZW5zaXZlIGRlZXAgdGVzdFxuICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGtleSA9IGthW2ldO1xuICAgIGlmICghZGVlcEVxdWFsKGFba2V5XSwgYltrZXldLCBvcHRzKSkgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0eXBlb2YgYSA9PT0gdHlwZW9mIGI7XG59XG59KTtcblxuY29uc3QgYXNzZXJ0aW9ucyA9IHtcbiAgb2sodmFsLCBtZXNzYWdlID0gJ3Nob3VsZCBiZSB0cnV0aHknKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogQm9vbGVhbih2YWwpLFxuICAgICAgZXhwZWN0ZWQ6ICd0cnV0aHknLFxuICAgICAgYWN0dWFsOiB2YWwsXG4gICAgICBvcGVyYXRvcjogJ29rJyxcbiAgICAgIG1lc3NhZ2VcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBkZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSA9ICdzaG91bGQgYmUgZXF1aXZhbGVudCcpIHtcbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzOiBpbmRleCQxKGFjdHVhbCwgZXhwZWN0ZWQpLFxuICAgICAgYWN0dWFsLFxuICAgICAgZXhwZWN0ZWQsXG4gICAgICBtZXNzYWdlLFxuICAgICAgb3BlcmF0b3I6ICdkZWVwRXF1YWwnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgZXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSA9ICdzaG91bGQgYmUgZXF1YWwnKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogYWN0dWFsID09PSBleHBlY3RlZCxcbiAgICAgIGFjdHVhbCxcbiAgICAgIGV4cGVjdGVkLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIG9wZXJhdG9yOiAnZXF1YWwnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgbm90T2sodmFsLCBtZXNzYWdlID0gJ3Nob3VsZCBub3QgYmUgdHJ1dGh5Jykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6ICFCb29sZWFuKHZhbCksXG4gICAgICBleHBlY3RlZDogJ2ZhbHN5JyxcbiAgICAgIGFjdHVhbDogdmFsLFxuICAgICAgb3BlcmF0b3I6ICdub3RPaycsXG4gICAgICBtZXNzYWdlXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgbm90RGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UgPSAnc2hvdWxkIG5vdCBiZSBlcXVpdmFsZW50Jykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6ICFpbmRleCQxKGFjdHVhbCwgZXhwZWN0ZWQpLFxuICAgICAgYWN0dWFsLFxuICAgICAgZXhwZWN0ZWQsXG4gICAgICBtZXNzYWdlLFxuICAgICAgb3BlcmF0b3I6ICdub3REZWVwRXF1YWwnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgbm90RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSA9ICdzaG91bGQgbm90IGJlIGVxdWFsJykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6IGFjdHVhbCAhPT0gZXhwZWN0ZWQsXG4gICAgICBhY3R1YWwsXG4gICAgICBleHBlY3RlZCxcbiAgICAgIG1lc3NhZ2UsXG4gICAgICBvcGVyYXRvcjogJ25vdEVxdWFsJ1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIHRocm93cyhmdW5jLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuICAgIGxldCBjYXVnaHQsIHBhc3MsIGFjdHVhbDtcbiAgICBpZiAodHlwZW9mIGV4cGVjdGVkID09PSAnc3RyaW5nJykge1xuICAgICAgW2V4cGVjdGVkLCBtZXNzYWdlXSA9IFttZXNzYWdlLCBleHBlY3RlZF07XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBmdW5jKCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNhdWdodCA9IHtlcnJvcn07XG4gICAgfVxuICAgIHBhc3MgPSBjYXVnaHQgIT09IHVuZGVmaW5lZDtcbiAgICBhY3R1YWwgPSBjYXVnaHQgJiYgY2F1Z2h0LmVycm9yO1xuICAgIGlmIChleHBlY3RlZCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgcGFzcyA9IGV4cGVjdGVkLnRlc3QoYWN0dWFsKSB8fCBleHBlY3RlZC50ZXN0KGFjdHVhbCAmJiBhY3R1YWwubWVzc2FnZSk7XG4gICAgICBleHBlY3RlZCA9IFN0cmluZyhleHBlY3RlZCk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZXhwZWN0ZWQgPT09ICdmdW5jdGlvbicgJiYgY2F1Z2h0KSB7XG4gICAgICBwYXNzID0gYWN0dWFsIGluc3RhbmNlb2YgZXhwZWN0ZWQ7XG4gICAgICBhY3R1YWwgPSBhY3R1YWwuY29uc3RydWN0b3I7XG4gICAgfVxuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3MsXG4gICAgICBleHBlY3RlZCxcbiAgICAgIGFjdHVhbCxcbiAgICAgIG9wZXJhdG9yOiAndGhyb3dzJyxcbiAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UgfHwgJ3Nob3VsZCB0aHJvdydcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBkb2VzTm90VGhyb3coZnVuYywgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcbiAgICBsZXQgY2F1Z2h0O1xuICAgIGlmICh0eXBlb2YgZXhwZWN0ZWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBbZXhwZWN0ZWQsIG1lc3NhZ2VdID0gW21lc3NhZ2UsIGV4cGVjdGVkXTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGZ1bmMoKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY2F1Z2h0ID0ge2Vycm9yfTtcbiAgICB9XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogY2F1Z2h0ID09PSB1bmRlZmluZWQsXG4gICAgICBleHBlY3RlZDogJ25vIHRocm93biBlcnJvcicsXG4gICAgICBhY3R1YWw6IGNhdWdodCAmJiBjYXVnaHQuZXJyb3IsXG4gICAgICBvcGVyYXRvcjogJ2RvZXNOb3RUaHJvdycsXG4gICAgICBtZXNzYWdlOiBtZXNzYWdlIHx8ICdzaG91bGQgbm90IHRocm93J1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIGZhaWwocmVhc29uID0gJ2ZhaWwgY2FsbGVkJykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6IGZhbHNlLFxuICAgICAgYWN0dWFsOiAnZmFpbCBjYWxsZWQnLFxuICAgICAgZXhwZWN0ZWQ6ICdmYWlsIG5vdCBjYWxsZWQnLFxuICAgICAgbWVzc2FnZTogcmVhc29uLFxuICAgICAgb3BlcmF0b3I6ICdmYWlsJ1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGFzc2VydGlvbiAodGVzdCkge1xuICByZXR1cm4gT2JqZWN0LmNyZWF0ZShhc3NlcnRpb25zLCB7dGVzdDoge3ZhbHVlOiB0ZXN0fX0pO1xufVxuXG5jb25zdCBUZXN0ID0ge1xuICBydW46IGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCBhc3NlcnQgPSBhc3NlcnRpb24odGhpcyk7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICByZXR1cm4gaW5kZXgodGhpcy5jb3JvdXRpbmUoYXNzZXJ0KSlcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIHthc3NlcnRpb25zOiB0aGlzLmFzc2VydGlvbnMsIGV4ZWN1dGlvblRpbWU6IERhdGUubm93KCkgLSBub3d9O1xuICAgICAgfSk7XG4gIH0sXG4gIGFkZEFzc2VydGlvbigpe1xuICAgIGNvbnN0IG5ld0Fzc2VydGlvbnMgPSBbLi4uYXJndW1lbnRzXS5tYXAoYSA9PiBPYmplY3QuYXNzaWduKHtkZXNjcmlwdGlvbjogdGhpcy5kZXNjcmlwdGlvbn0sIGEpKTtcbiAgICB0aGlzLmFzc2VydGlvbnMucHVzaCguLi5uZXdBc3NlcnRpb25zKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxufTtcblxuZnVuY3Rpb24gdGVzdCAoe2Rlc2NyaXB0aW9uLCBjb3JvdXRpbmUsIG9ubHkgPSBmYWxzZX0pIHtcbiAgcmV0dXJuIE9iamVjdC5jcmVhdGUoVGVzdCwge1xuICAgIGRlc2NyaXB0aW9uOiB7dmFsdWU6IGRlc2NyaXB0aW9ufSxcbiAgICBjb3JvdXRpbmU6IHt2YWx1ZTogY29yb3V0aW5lfSxcbiAgICBhc3NlcnRpb25zOiB7dmFsdWU6IFtdfSxcbiAgICBvbmx5OiB7dmFsdWU6IG9ubHl9LFxuICAgIGxlbmd0aDoge1xuICAgICAgZ2V0KCl7XG4gICAgICAgIHJldHVybiB0aGlzLmFzc2VydGlvbnMubGVuZ3RoXG4gICAgICB9XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gdGFwT3V0ICh7cGFzcywgbWVzc2FnZSwgaW5kZXh9KSB7XG4gIGNvbnN0IHN0YXR1cyA9IHBhc3MgPT09IHRydWUgPyAnb2snIDogJ25vdCBvayc7XG4gIGNvbnNvbGUubG9nKFtzdGF0dXMsIGluZGV4LCBtZXNzYWdlXS5qb2luKCcgJykpO1xufVxuXG5mdW5jdGlvbiBjYW5FeGl0ICgpIHtcbiAgcmV0dXJuIHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgcHJvY2Vzcy5leGl0ID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiB0YXAgKCkge1xuICByZXR1cm4gZnVuY3Rpb24gKiAoKSB7XG4gICAgbGV0IGluZGV4ID0gMTtcbiAgICBsZXQgbGFzdElkID0gMDtcbiAgICBsZXQgc3VjY2VzcyA9IDA7XG4gICAgbGV0IGZhaWx1cmUgPSAwO1xuXG4gICAgY29uc3Qgc3RhclRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnNvbGUubG9nKCdUQVAgdmVyc2lvbiAxMycpO1xuICAgIHRyeSB7XG4gICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBjb25zdCBhc3NlcnRpb24gPSB5aWVsZDtcbiAgICAgICAgaWYgKGFzc2VydGlvbi5wYXNzID09PSB0cnVlKSB7XG4gICAgICAgICAgc3VjY2VzcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZhaWx1cmUrKztcbiAgICAgICAgfVxuICAgICAgICBhc3NlcnRpb24uaW5kZXggPSBpbmRleDtcbiAgICAgICAgaWYgKGFzc2VydGlvbi5pZCAhPT0gbGFzdElkKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYCMgJHthc3NlcnRpb24uZGVzY3JpcHRpb259IC0gJHthc3NlcnRpb24uZXhlY3V0aW9uVGltZX1tc2ApO1xuICAgICAgICAgIGxhc3RJZCA9IGFzc2VydGlvbi5pZDtcbiAgICAgICAgfVxuICAgICAgICB0YXBPdXQoYXNzZXJ0aW9uKTtcbiAgICAgICAgaWYgKGFzc2VydGlvbi5wYXNzICE9PSB0cnVlKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYCAgLS0tXG4gIG9wZXJhdG9yOiAke2Fzc2VydGlvbi5vcGVyYXRvcn1cbiAgZXhwZWN0ZWQ6ICR7SlNPTi5zdHJpbmdpZnkoYXNzZXJ0aW9uLmV4cGVjdGVkKX1cbiAgYWN0dWFsOiAke0pTT04uc3RyaW5naWZ5KGFzc2VydGlvbi5hY3R1YWwpfVxuICAuLi5gKTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdCYWlsIG91dCEgdW5oYW5kbGVkIGV4Y2VwdGlvbicpO1xuICAgICAgY29uc29sZS5sb2coZSk7XG4gICAgICBpZiAoY2FuRXhpdCgpKSB7XG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZmluYWxseSB7XG4gICAgICBjb25zdCBleGVjdXRpb24gPSBEYXRlLm5vdygpIC0gc3RhclRpbWU7XG4gICAgICBpZiAoaW5kZXggPiAxKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBcbjEuLiR7aW5kZXggLSAxfVxuIyBkdXJhdGlvbiAke2V4ZWN1dGlvbn1tc1xuIyBzdWNjZXNzICR7c3VjY2Vzc31cbiMgZmFpbHVyZSAke2ZhaWx1cmV9YCk7XG4gICAgICB9XG4gICAgICBpZiAoZmFpbHVyZSAmJiBjYW5FeGl0KCkpIHtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuY29uc3QgUGxhbiA9IHtcbiAgdGVzdChkZXNjcmlwdGlvbiwgY29yb3V0aW5lLCBvcHRzID0ge30pe1xuICAgIGNvbnN0IHRlc3RJdGVtcyA9ICghY29yb3V0aW5lICYmIGRlc2NyaXB0aW9uLnRlc3RzKSA/IFsuLi5kZXNjcmlwdGlvbl0gOiBbe2Rlc2NyaXB0aW9uLCBjb3JvdXRpbmV9XTtcbiAgICB0aGlzLnRlc3RzLnB1c2goLi4udGVzdEl0ZW1zLm1hcCh0PT50ZXN0KE9iamVjdC5hc3NpZ24odCwgb3B0cykpKSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgb25seShkZXNjcmlwdGlvbiwgY29yb3V0aW5lKXtcbiAgICByZXR1cm4gdGhpcy50ZXN0KGRlc2NyaXB0aW9uLCBjb3JvdXRpbmUsIHtvbmx5OiB0cnVlfSk7XG4gIH0sXG5cbiAgcnVuKHNpbmsgPSB0YXAoKSl7XG4gICAgY29uc3Qgc2lua0l0ZXJhdG9yID0gc2luaygpO1xuICAgIHNpbmtJdGVyYXRvci5uZXh0KCk7XG4gICAgY29uc3QgaGFzT25seSA9IHRoaXMudGVzdHMuc29tZSh0PT50Lm9ubHkpO1xuICAgIGNvbnN0IHJ1bm5hYmxlID0gaGFzT25seSA/IHRoaXMudGVzdHMuZmlsdGVyKHQ9PnQub25seSkgOiB0aGlzLnRlc3RzO1xuICAgIHJldHVybiBpbmRleChmdW5jdGlvbiAqICgpIHtcbiAgICAgIGxldCBpZCA9IDE7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHRzID0gcnVubmFibGUubWFwKHQ9PnQucnVuKCkpO1xuICAgICAgICBmb3IgKGxldCByIG9mIHJlc3VsdHMpIHtcbiAgICAgICAgICBjb25zdCB7YXNzZXJ0aW9ucywgZXhlY3V0aW9uVGltZX0gPSB5aWVsZCByO1xuICAgICAgICAgIGZvciAobGV0IGFzc2VydCBvZiBhc3NlcnRpb25zKSB7XG4gICAgICAgICAgICBzaW5rSXRlcmF0b3IubmV4dChPYmplY3QuYXNzaWduKGFzc2VydCwge2lkLCBleGVjdXRpb25UaW1lfSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZCsrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYXRjaCAoZSkge1xuICAgICAgICBzaW5rSXRlcmF0b3IudGhyb3coZSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBzaW5rSXRlcmF0b3IucmV0dXJuKCk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKVxuICB9LFxuXG4gICogW1N5bWJvbC5pdGVyYXRvcl0oKXtcbiAgICBmb3IgKGxldCB0IG9mIHRoaXMudGVzdHMpIHtcbiAgICAgIHlpZWxkIHQ7XG4gICAgfVxuICB9XG59O1xuXG5mdW5jdGlvbiBwbGFuICgpIHtcbiAgcmV0dXJuIE9iamVjdC5jcmVhdGUoUGxhbiwge1xuICAgIHRlc3RzOiB7dmFsdWU6IFtdfSxcbiAgICBsZW5ndGg6IHtcbiAgICAgIGdldCgpe1xuICAgICAgICByZXR1cm4gdGhpcy50ZXN0cy5sZW5ndGhcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBwbGFuO1xuIiwiZXhwb3J0IGZ1bmN0aW9uIHN3YXAgKGYpIHtcbiAgcmV0dXJuIChhLCBiKSA9PiBmKGIsIGEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcG9zZSAoZmlyc3QsIC4uLmZucykge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZucy5yZWR1Y2UoKHByZXZpb3VzLCBjdXJyZW50KSA9PiBjdXJyZW50KHByZXZpb3VzKSwgZmlyc3QoLi4uYXJncykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VycnkgKGZuLCBhcml0eUxlZnQpIHtcbiAgY29uc3QgYXJpdHkgPSBhcml0eUxlZnQgfHwgZm4ubGVuZ3RoO1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCBhcmdMZW5ndGggPSBhcmdzLmxlbmd0aCB8fCAxO1xuICAgIGlmIChhcml0eSA9PT0gYXJnTGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZm4oLi4uYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGZ1bmMgPSAoLi4ubW9yZUFyZ3MpID0+IGZuKC4uLmFyZ3MsIC4uLm1vcmVBcmdzKTtcbiAgICAgIHJldHVybiBjdXJyeShmdW5jLCBhcml0eSAtIGFyZ3MubGVuZ3RoKTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseSAoZm4pIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRhcCAoZm4pIHtcbiAgcmV0dXJuIGFyZyA9PiB7XG4gICAgZm4oYXJnKTtcbiAgICByZXR1cm4gYXJnO1xuICB9XG59IiwiaW1wb3J0IHtjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuZXhwb3J0IGZ1bmN0aW9uKiBnaXZlTWVOIChuKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbjsgaSsrKSB7XG4gICAgeWllbGQgaTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgZG9OVGltZXMgPSBjdXJyeSgoZm4sIGNvdW50ID0gMSkgPT4ge1xuICBjb25zdCBuID0gY291bnQgfHwgMTtcbiAgWy4uLmdpdmVNZU4obildLmZvckVhY2goKCkgPT4gZm4oKSk7XG59LCAyKTtcbiIsImltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuaW1wb3J0IHtnaXZlTWVOLCBkb05UaW1lc30gZnJvbSAnLi4vbGliL2hlbHBlcic7XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnZ2l2ZSBtZSBuJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IG4gPSBbLi4uZ2l2ZU1lTig1KV07XG4gICAgdC5kZWVwRXF1YWwobiwgWzAsIDEsIDIsIDMsIDQsXSk7XG4gIH0pXG4gIC50ZXN0KCdnaXZlIG1lIG5vbmUnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgbiA9IFsuLi5naXZlTWVOKCldO1xuICAgIHQuZGVlcEVxdWFsKG4sIFtdKTtcbiAgfSlcbiAgLnRlc3QoJ2RvIG4gdGltZXMnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgbGV0IGNvdW50ZXIgPSAwO1xuICAgIGRvTlRpbWVzKCgpID0+IGNvdW50ZXIrKywgNCk7XG4gICAgdC5lcXVhbChjb3VudGVyLCA0KTtcbiAgfSlcbiAgLnRlc3QoJ2RvIG4gdGltZXMgKGN1cnJpZWQpJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGxldCBjb3VudGVyID0gMDtcbiAgICBkb05UaW1lcygoKSA9PiBjb3VudGVyKyspKDQpO1xuICAgIHQuZXF1YWwoY291bnRlciwgNCk7XG4gIH0pXG4gIC50ZXN0KCdkbyBvbmNlIGJ5IGRlZmF1bHQnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgbGV0IGNvdW50ZXIgPSAwO1xuICAgIGRvTlRpbWVzKCgpID0+IGNvdW50ZXIrKykoKTtcbiAgICB0LmVxdWFsKGNvdW50ZXIsIDEpO1xuICB9KTsiLCJpbXBvcnQge2dpdmVNZU59IGZyb20gJy4vaGVscGVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHt0YWJsZX0pIHtcbiAgcmV0dXJuIHtcbiAgICBwdWxsKG9mZnNldCwgbnVtYmVyKXtcbiAgICAgIGNvbnN0IHRhYmxlU3RhdGUgPSB0YWJsZS5nZXRUYWJsZVN0YXRlKCk7XG4gICAgICBjb25zdCB7c2xpY2U6e3NpemU6cGFnZVNpemV9fSA9IHRhYmxlU3RhdGU7XG4gICAgICBjb25zdCBzdGFydFBhZ2UgPSBNYXRoLmZsb29yKG9mZnNldCAvIHBhZ2VTaXplKTtcbiAgICAgIGNvbnN0IHRyaW1CZWZvcmUgPSBvZmZzZXQgJSBwYWdlU2l6ZTtcbiAgICAgIGNvbnN0IGxhc3RQYWdlID0gTWF0aC5jZWlsKChvZmZzZXQgKyBudW1iZXIpIC8gcGFnZVNpemUpO1xuICAgICAgY29uc3QgcGFnZUNvbmZMaXN0ID0gWy4uLmdpdmVNZU4obGFzdFBhZ2UgLSBzdGFydFBhZ2UpXS5tYXAob2ZmID0+ICh7XG4gICAgICAgIHBhZ2U6IHN0YXJ0UGFnZSArIG9mZiArIDEsXG4gICAgICAgIHNpemU6IHBhZ2VTaXplXG4gICAgICB9KSk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5hbGwocGFnZUNvbmZMaXN0Lm1hcChzbGljZSA9PiB7XG4gICAgICAgIHJldHVybiB0YWJsZS5ldmFsKE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUsIHtzbGljZX0pKTtcbiAgICAgIH0sIFtdKSlcbiAgICAgICAgLnRoZW4ocGFnZXMgPT4ge1xuICAgICAgICAgIHJldHVybiBwYWdlcy5yZWR1Y2UoKGFjYywgY3VycikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFjYy5jb25jYXQoY3Vycik7XG4gICAgICAgICAgfSwgW10pXG4gICAgICAgICAgICAuZmlsdGVyKChpdGVtLCBpbmRleCkgPT4gaW5kZXggPj0gdHJpbUJlZm9yZSlcbiAgICAgICAgICAgIC5zbGljZSgwLCBudW1iZXIpO1xuICAgICAgICB9KTtcbiAgICB9XG4gIH07XG59IiwiZXhwb3J0IGZ1bmN0aW9uIHN3YXAgKGYpIHtcbiAgcmV0dXJuIChhLCBiKSA9PiBmKGIsIGEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcG9zZSAoZmlyc3QsIC4uLmZucykge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZucy5yZWR1Y2UoKHByZXZpb3VzLCBjdXJyZW50KSA9PiBjdXJyZW50KHByZXZpb3VzKSwgZmlyc3QoLi4uYXJncykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VycnkgKGZuLCBhcml0eUxlZnQpIHtcbiAgY29uc3QgYXJpdHkgPSBhcml0eUxlZnQgfHwgZm4ubGVuZ3RoO1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCBhcmdMZW5ndGggPSBhcmdzLmxlbmd0aCB8fCAxO1xuICAgIGlmIChhcml0eSA9PT0gYXJnTGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZm4oLi4uYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGZ1bmMgPSAoLi4ubW9yZUFyZ3MpID0+IGZuKC4uLmFyZ3MsIC4uLm1vcmVBcmdzKTtcbiAgICAgIHJldHVybiBjdXJyeShmdW5jLCBhcml0eSAtIGFyZ3MubGVuZ3RoKTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseSAoZm4pIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRhcCAoZm4pIHtcbiAgcmV0dXJuIGFyZyA9PiB7XG4gICAgZm4oYXJnKTtcbiAgICByZXR1cm4gYXJnO1xuICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcG9pbnRlciAocGF0aCkge1xuXG4gIGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xuXG4gIGZ1bmN0aW9uIHBhcnRpYWwgKG9iaiA9IHt9LCBwYXJ0cyA9IFtdKSB7XG4gICAgY29uc3QgcCA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgY29uc3QgY3VycmVudCA9IG9ialtwXTtcbiAgICByZXR1cm4gKGN1cnJlbnQgPT09IHVuZGVmaW5lZCB8fCBwYXJ0cy5sZW5ndGggPT09IDApID9cbiAgICAgIGN1cnJlbnQgOiBwYXJ0aWFsKGN1cnJlbnQsIHBhcnRzKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldCAodGFyZ2V0LCBuZXdUcmVlKSB7XG4gICAgbGV0IGN1cnJlbnQgPSB0YXJnZXQ7XG4gICAgY29uc3QgW2xlYWYsIC4uLmludGVybWVkaWF0ZV0gPSBwYXJ0cy5yZXZlcnNlKCk7XG4gICAgZm9yIChsZXQga2V5IG9mIGludGVybWVkaWF0ZS5yZXZlcnNlKCkpIHtcbiAgICAgIGlmIChjdXJyZW50W2tleV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjdXJyZW50W2tleV0gPSB7fTtcbiAgICAgICAgY3VycmVudCA9IGN1cnJlbnRba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgY3VycmVudFtsZWFmXSA9IE9iamVjdC5hc3NpZ24oY3VycmVudFtsZWFmXSB8fCB7fSwgbmV3VHJlZSk7XG4gICAgcmV0dXJuIHRhcmdldDtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZ2V0KHRhcmdldCl7XG4gICAgICByZXR1cm4gcGFydGlhbCh0YXJnZXQsIFsuLi5wYXJ0c10pXG4gICAgfSxcbiAgICBzZXRcbiAgfVxufTtcbiIsImltcG9ydCB7c3dhcH0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cblxuZnVuY3Rpb24gc29ydEJ5UHJvcGVydHkgKHByb3ApIHtcbiAgY29uc3QgcHJvcEdldHRlciA9IHBvaW50ZXIocHJvcCkuZ2V0O1xuICByZXR1cm4gKGEsIGIpID0+IHtcbiAgICBjb25zdCBhVmFsID0gcHJvcEdldHRlcihhKTtcbiAgICBjb25zdCBiVmFsID0gcHJvcEdldHRlcihiKTtcblxuICAgIGlmIChhVmFsID09PSBiVmFsKSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBpZiAoYlZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuXG4gICAgaWYgKGFWYWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIDE7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFWYWwgPCBiVmFsID8gLTEgOiAxO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNvcnRGYWN0b3J5ICh7cG9pbnRlciwgZGlyZWN0aW9ufSA9IHt9KSB7XG4gIGlmICghcG9pbnRlciB8fCBkaXJlY3Rpb24gPT09ICdub25lJykge1xuICAgIHJldHVybiBhcnJheSA9PiBbLi4uYXJyYXldO1xuICB9XG5cbiAgY29uc3Qgb3JkZXJGdW5jID0gc29ydEJ5UHJvcGVydHkocG9pbnRlcik7XG4gIGNvbnN0IGNvbXBhcmVGdW5jID0gZGlyZWN0aW9uID09PSAnZGVzYycgPyBzd2FwKG9yZGVyRnVuYykgOiBvcmRlckZ1bmM7XG5cbiAgcmV0dXJuIChhcnJheSkgPT4gWy4uLmFycmF5XS5zb3J0KGNvbXBhcmVGdW5jKTtcbn0iLCJpbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5mdW5jdGlvbiB0eXBlRXhwcmVzc2lvbiAodHlwZSkge1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiBCb29sZWFuO1xuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gTnVtYmVyO1xuICAgIGNhc2UgJ2RhdGUnOlxuICAgICAgcmV0dXJuICh2YWwpID0+IG5ldyBEYXRlKHZhbCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBjb21wb3NlKFN0cmluZywgKHZhbCkgPT4gdmFsLnRvTG93ZXJDYXNlKCkpO1xuICB9XG59XG5cbmNvbnN0IG9wZXJhdG9ycyA9IHtcbiAgaW5jbHVkZXModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0LmluY2x1ZGVzKHZhbHVlKTtcbiAgfSxcbiAgaXModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IE9iamVjdC5pcyh2YWx1ZSwgaW5wdXQpO1xuICB9LFxuICBpc05vdCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gIU9iamVjdC5pcyh2YWx1ZSwgaW5wdXQpO1xuICB9LFxuICBsdCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPCB2YWx1ZTtcbiAgfSxcbiAgZ3QodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0ID4gdmFsdWU7XG4gIH0sXG4gIGx0ZSh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPD0gdmFsdWU7XG4gIH0sXG4gIGd0ZSh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPj0gdmFsdWU7XG4gIH0sXG4gIGVxdWFscyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gdmFsdWUgPT0gaW5wdXQ7XG4gIH0sXG4gIG5vdEVxdWFscyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gdmFsdWUgIT0gaW5wdXQ7XG4gIH1cbn07XG5cbmNvbnN0IGV2ZXJ5ID0gZm5zID0+ICguLi5hcmdzKSA9PiBmbnMuZXZlcnkoZm4gPT4gZm4oLi4uYXJncykpO1xuXG5leHBvcnQgZnVuY3Rpb24gcHJlZGljYXRlICh7dmFsdWUgPSAnJywgb3BlcmF0b3IgPSAnaW5jbHVkZXMnLCB0eXBlID0gJ3N0cmluZyd9KSB7XG4gIGNvbnN0IHR5cGVJdCA9IHR5cGVFeHByZXNzaW9uKHR5cGUpO1xuICBjb25zdCBvcGVyYXRlT25UeXBlZCA9IGNvbXBvc2UodHlwZUl0LCBvcGVyYXRvcnNbb3BlcmF0b3JdKTtcbiAgY29uc3QgcHJlZGljYXRlRnVuYyA9IG9wZXJhdGVPblR5cGVkKHZhbHVlKTtcbiAgcmV0dXJuIGNvbXBvc2UodHlwZUl0LCBwcmVkaWNhdGVGdW5jKTtcbn1cblxuLy9hdm9pZCB1c2VsZXNzIGZpbHRlciBsb29rdXAgKGltcHJvdmUgcGVyZilcbmZ1bmN0aW9uIG5vcm1hbGl6ZUNsYXVzZXMgKGNvbmYpIHtcbiAgY29uc3Qgb3V0cHV0ID0ge307XG4gIGNvbnN0IHZhbGlkUGF0aCA9IE9iamVjdC5rZXlzKGNvbmYpLmZpbHRlcihwYXRoID0+IEFycmF5LmlzQXJyYXkoY29uZltwYXRoXSkpO1xuICB2YWxpZFBhdGguZm9yRWFjaChwYXRoID0+IHtcbiAgICBjb25zdCB2YWxpZENsYXVzZXMgPSBjb25mW3BhdGhdLmZpbHRlcihjID0+IGMudmFsdWUgIT09ICcnKTtcbiAgICBpZiAodmFsaWRDbGF1c2VzLmxlbmd0aCkge1xuICAgICAgb3V0cHV0W3BhdGhdID0gdmFsaWRDbGF1c2VzO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGZpbHRlciAoZmlsdGVyKSB7XG4gIGNvbnN0IG5vcm1hbGl6ZWRDbGF1c2VzID0gbm9ybWFsaXplQ2xhdXNlcyhmaWx0ZXIpO1xuICBjb25zdCBmdW5jTGlzdCA9IE9iamVjdC5rZXlzKG5vcm1hbGl6ZWRDbGF1c2VzKS5tYXAocGF0aCA9PiB7XG4gICAgY29uc3QgZ2V0dGVyID0gcG9pbnRlcihwYXRoKS5nZXQ7XG4gICAgY29uc3QgY2xhdXNlcyA9IG5vcm1hbGl6ZWRDbGF1c2VzW3BhdGhdLm1hcChwcmVkaWNhdGUpO1xuICAgIHJldHVybiBjb21wb3NlKGdldHRlciwgZXZlcnkoY2xhdXNlcykpO1xuICB9KTtcbiAgY29uc3QgZmlsdGVyUHJlZGljYXRlID0gZXZlcnkoZnVuY0xpc3QpO1xuXG4gIHJldHVybiAoYXJyYXkpID0+IGFycmF5LmZpbHRlcihmaWx0ZXJQcmVkaWNhdGUpO1xufSIsImltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChzZWFyY2hDb25mID0ge30pIHtcbiAgY29uc3Qge3ZhbHVlLCBzY29wZSA9IFtdfSA9IHNlYXJjaENvbmY7XG4gIGNvbnN0IHNlYXJjaFBvaW50ZXJzID0gc2NvcGUubWFwKGZpZWxkID0+IHBvaW50ZXIoZmllbGQpLmdldCk7XG4gIGlmICghc2NvcGUubGVuZ3RoIHx8ICF2YWx1ZSkge1xuICAgIHJldHVybiBhcnJheSA9PiBhcnJheTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gYXJyYXkuZmlsdGVyKGl0ZW0gPT4gc2VhcmNoUG9pbnRlcnMuc29tZShwID0+IFN0cmluZyhwKGl0ZW0pKS5pbmNsdWRlcyhTdHJpbmcodmFsdWUpKSkpXG4gIH1cbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzbGljZUZhY3RvcnkgKHtwYWdlID0gMSwgc2l6ZX0gPSB7fSkge1xuICByZXR1cm4gZnVuY3Rpb24gc2xpY2VGdW5jdGlvbiAoYXJyYXkgPSBbXSkge1xuICAgIGNvbnN0IGFjdHVhbFNpemUgPSBzaXplIHx8IGFycmF5Lmxlbmd0aDtcbiAgICBjb25zdCBvZmZzZXQgPSAocGFnZSAtIDEpICogYWN0dWFsU2l6ZTtcbiAgICByZXR1cm4gYXJyYXkuc2xpY2Uob2Zmc2V0LCBvZmZzZXQgKyBhY3R1YWxTaXplKTtcbiAgfTtcbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBlbWl0dGVyICgpIHtcblxuICBjb25zdCBsaXN0ZW5lcnNMaXN0cyA9IHt9O1xuXG4gIHJldHVybiB7XG4gICAgb24oZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSAobGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdKS5jb25jYXQobGlzdGVuZXJzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgZGlzcGF0Y2goZXZlbnQsIC4uLmFyZ3Mpe1xuICAgICAgY29uc3QgbGlzdGVuZXJzID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgZm9yIChsZXQgbGlzdGVuZXIgb2YgbGlzdGVuZXJzKSB7XG4gICAgICAgIGxpc3RlbmVyKC4uLmFyZ3MpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBvZmYoZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGxpc3RlbmVyc0xpc3RzKS5mb3JFYWNoKGV2ID0+IHRoaXMub2ZmKGV2KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBsaXN0ID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSBsaXN0ZW5lcnMubGVuZ3RoID8gbGlzdC5maWx0ZXIobGlzdGVuZXIgPT4gIWxpc3RlbmVycy5pbmNsdWRlcyhsaXN0ZW5lcikpIDogW107XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb3h5TGlzdGVuZXIgKGV2ZW50TWFwKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoe2VtaXR0ZXJ9KSB7XG5cbiAgICBjb25zdCBwcm94eSA9IHt9O1xuICAgIGxldCBldmVudExpc3RlbmVycyA9IHt9O1xuXG4gICAgZm9yIChsZXQgZXYgb2YgT2JqZWN0LmtleXMoZXZlbnRNYXApKSB7XG4gICAgICBjb25zdCBtZXRob2QgPSBldmVudE1hcFtldl07XG4gICAgICBldmVudExpc3RlbmVyc1tldl0gPSBbXTtcbiAgICAgIHByb3h5W21ldGhvZF0gPSBmdW5jdGlvbiAoLi4ubGlzdGVuZXJzKSB7XG4gICAgICAgIGV2ZW50TGlzdGVuZXJzW2V2XSA9IGV2ZW50TGlzdGVuZXJzW2V2XS5jb25jYXQobGlzdGVuZXJzKTtcbiAgICAgICAgZW1pdHRlci5vbihldiwgLi4ubGlzdGVuZXJzKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHByb3h5LCB7XG4gICAgICBvZmYoZXYpe1xuICAgICAgICBpZiAoIWV2KSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMoZXZlbnRMaXN0ZW5lcnMpLmZvckVhY2goZXZlbnROYW1lID0+IHRoaXMub2ZmKGV2ZW50TmFtZSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50TGlzdGVuZXJzW2V2XSkge1xuICAgICAgICAgIGVtaXR0ZXIub2ZmKGV2LCAuLi5ldmVudExpc3RlbmVyc1tldl0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0iLCJleHBvcnQgY29uc3QgVE9HR0xFX1NPUlQgPSAnVE9HR0xFX1NPUlQnO1xuZXhwb3J0IGNvbnN0IERJU1BMQVlfQ0hBTkdFRCA9ICdESVNQTEFZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFBBR0VfQ0hBTkdFRCA9ICdDSEFOR0VfUEFHRSc7XG5leHBvcnQgY29uc3QgRVhFQ19DSEFOR0VEID0gJ0VYRUNfU1RBUlRFRCc7XG5leHBvcnQgY29uc3QgRklMVEVSX0NIQU5HRUQgPSAnRklMVEVSX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNVTU1BUllfQ0hBTkdFRCA9ICdTVU1NQVJZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNFQVJDSF9DSEFOR0VEID0gJ1NFQVJDSF9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBFWEVDX0VSUk9SID0gJ0VYRUNfRVJST1InOyIsImltcG9ydCBzbGljZSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge2N1cnJ5LCB0YXAsIGNvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuaW1wb3J0IHtlbWl0dGVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuaW1wb3J0IHNsaWNlRmFjdG9yeSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge1xuICBTVU1NQVJZX0NIQU5HRUQsXG4gIFRPR0dMRV9TT1JULFxuICBESVNQTEFZX0NIQU5HRUQsXG4gIFBBR0VfQ0hBTkdFRCxcbiAgRVhFQ19DSEFOR0VELFxuICBGSUxURVJfQ0hBTkdFRCxcbiAgU0VBUkNIX0NIQU5HRUQsXG4gIEVYRUNfRVJST1Jcbn0gZnJvbSAnLi4vZXZlbnRzJztcblxuZnVuY3Rpb24gY3VycmllZFBvaW50ZXIgKHBhdGgpIHtcbiAgY29uc3Qge2dldCwgc2V0fSA9IHBvaW50ZXIocGF0aCk7XG4gIHJldHVybiB7Z2V0LCBzZXQ6IGN1cnJ5KHNldCl9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSxcbiAgdGFibGVTdGF0ZSxcbiAgZGF0YSxcbiAgZmlsdGVyRmFjdG9yeSxcbiAgc2VhcmNoRmFjdG9yeVxufSkge1xuICBjb25zdCB0YWJsZSA9IGVtaXR0ZXIoKTtcbiAgY29uc3Qgc29ydFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc29ydCcpO1xuICBjb25zdCBzbGljZVBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2xpY2UnKTtcbiAgY29uc3QgZmlsdGVyUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdmaWx0ZXInKTtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzZWFyY2gnKTtcblxuICBjb25zdCBzYWZlQXNzaWduID0gY3VycnkoKGJhc2UsIGV4dGVuc2lvbikgPT4gT2JqZWN0LmFzc2lnbih7fSwgYmFzZSwgZXh0ZW5zaW9uKSk7XG4gIGNvbnN0IGRpc3BhdGNoID0gY3VycnkodGFibGUuZGlzcGF0Y2guYmluZCh0YWJsZSksIDIpO1xuXG4gIGNvbnN0IGNyZWF0ZVN1bW1hcnkgPSAoZmlsdGVyZWQpID0+IHtcbiAgICBkaXNwYXRjaChTVU1NQVJZX0NIQU5HRUQsIHtcbiAgICAgIHBhZ2U6IHRhYmxlU3RhdGUuc2xpY2UucGFnZSxcbiAgICAgIHNpemU6IHRhYmxlU3RhdGUuc2xpY2Uuc2l6ZSxcbiAgICAgIGZpbHRlcmVkQ291bnQ6IGZpbHRlcmVkLmxlbmd0aFxuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IGV4ZWMgPSAoe3Byb2Nlc3NpbmdEZWxheSA9IDIwfSA9IHt9KSA9PiB7XG4gICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogdHJ1ZX0pO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNvcnRGdW5jID0gc29ydEZhY3Rvcnkoc29ydFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgdGFwKGNyZWF0ZVN1bW1hcnkpLCBzb3J0RnVuYywgc2xpY2VGdW5jKTtcbiAgICAgICAgY29uc3QgZGlzcGxheWVkID0gZXhlY0Z1bmMoZGF0YSk7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKERJU1BMQVlfQ0hBTkdFRCwgZGlzcGxheWVkLm1hcChkID0+IHtcbiAgICAgICAgICByZXR1cm4ge2luZGV4OiBkYXRhLmluZGV4T2YoZCksIHZhbHVlOiBkfTtcbiAgICAgICAgfSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0VSUk9SLCBlKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfQ0hBTkdFRCwge3dvcmtpbmc6IGZhbHNlfSk7XG4gICAgICB9XG4gICAgfSwgcHJvY2Vzc2luZ0RlbGF5KTtcbiAgfTtcblxuICBjb25zdCB1cGRhdGVUYWJsZVN0YXRlID0gY3VycnkoKHB0ZXIsIGV2LCBuZXdQYXJ0aWFsU3RhdGUpID0+IGNvbXBvc2UoXG4gICAgc2FmZUFzc2lnbihwdGVyLmdldCh0YWJsZVN0YXRlKSksXG4gICAgdGFwKGRpc3BhdGNoKGV2KSksXG4gICAgcHRlci5zZXQodGFibGVTdGF0ZSlcbiAgKShuZXdQYXJ0aWFsU3RhdGUpKTtcblxuICBjb25zdCByZXNldFRvRmlyc3RQYWdlID0gKCkgPT4gdXBkYXRlVGFibGVTdGF0ZShzbGljZVBvaW50ZXIsIFBBR0VfQ0hBTkdFRCwge3BhZ2U6IDF9KTtcblxuICBjb25zdCB0YWJsZU9wZXJhdGlvbiA9IChwdGVyLCBldikgPT4gY29tcG9zZShcbiAgICB1cGRhdGVUYWJsZVN0YXRlKHB0ZXIsIGV2KSxcbiAgICByZXNldFRvRmlyc3RQYWdlLFxuICAgICgpID0+IHRhYmxlLmV4ZWMoKSAvLyB3ZSB3cmFwIHdpdGhpbiBhIGZ1bmN0aW9uIHNvIHRhYmxlLmV4ZWMgY2FuIGJlIG92ZXJ3cml0dGVuICh3aGVuIHVzaW5nIHdpdGggYSBzZXJ2ZXIgZm9yIGV4YW1wbGUpXG4gICk7XG5cbiAgY29uc3QgYXBpID0ge1xuICAgIHNvcnQ6IHRhYmxlT3BlcmF0aW9uKHNvcnRQb2ludGVyLCBUT0dHTEVfU09SVCksXG4gICAgZmlsdGVyOiB0YWJsZU9wZXJhdGlvbihmaWx0ZXJQb2ludGVyLCBGSUxURVJfQ0hBTkdFRCksXG4gICAgc2VhcmNoOiB0YWJsZU9wZXJhdGlvbihzZWFyY2hQb2ludGVyLCBTRUFSQ0hfQ0hBTkdFRCksXG4gICAgc2xpY2U6IGNvbXBvc2UodXBkYXRlVGFibGVTdGF0ZShzbGljZVBvaW50ZXIsIFBBR0VfQ0hBTkdFRCksICgpID0+IHRhYmxlLmV4ZWMoKSksXG4gICAgZXhlYyxcbiAgICBldmFsKHN0YXRlID0gdGFibGVTdGF0ZSl7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGNvbnN0IHNvcnRGdW5jID0gc29ydEZhY3Rvcnkoc29ydFBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3Qgc2VhcmNoRnVuYyA9IHNlYXJjaEZhY3Rvcnkoc2VhcmNoUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBmaWx0ZXJGdW5jID0gZmlsdGVyRmFjdG9yeShmaWx0ZXJQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IHNsaWNlRnVuYyA9IHNsaWNlRmFjdG9yeShzbGljZVBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3QgZXhlY0Z1bmMgPSBjb21wb3NlKGZpbHRlckZ1bmMsIHNlYXJjaEZ1bmMsIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICAgIHJldHVybiBleGVjRnVuYyhkYXRhKS5tYXAoZCA9PiB7XG4gICAgICAgICAgICByZXR1cm4ge2luZGV4OiBkYXRhLmluZGV4T2YoZCksIHZhbHVlOiBkfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIG9uRGlzcGxheUNoYW5nZShmbil7XG4gICAgICB0YWJsZS5vbihESVNQTEFZX0NIQU5HRUQsIGZuKTtcbiAgICB9LFxuICAgIGdldFRhYmxlU3RhdGUoKXtcbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlKVxuICAgIH1cbiAgfTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbih0YWJsZSwgYXBpKTtcbn0iLCJpbXBvcnQgc29ydCBmcm9tICdzbWFydC10YWJsZS1zb3J0JztcbmltcG9ydCBmaWx0ZXIgZnJvbSAnc21hcnQtdGFibGUtZmlsdGVyJztcbmltcG9ydCBzZWFyY2ggZnJvbSAnc21hcnQtdGFibGUtc2VhcmNoJztcbmltcG9ydCB0YWJsZSBmcm9tICcuL2RpcmVjdGl2ZXMvdGFibGUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSA9IHNvcnQsXG4gIGZpbHRlckZhY3RvcnkgPSBmaWx0ZXIsXG4gIHNlYXJjaEZhY3RvcnkgPSBzZWFyY2gsXG4gIHRhYmxlU3RhdGUgPSB7c29ydDoge30sIHNsaWNlOiB7cGFnZTogMX0sIGZpbHRlcjoge30sIHNlYXJjaDoge319LFxuICBkYXRhID0gW11cbn0sIC4uLnRhYmxlRGlyZWN0aXZlcykge1xuXG4gIGNvbnN0IGNvcmVUYWJsZSA9IHRhYmxlKHtzb3J0RmFjdG9yeSwgZmlsdGVyRmFjdG9yeSwgdGFibGVTdGF0ZSwgZGF0YSwgc2VhcmNoRmFjdG9yeX0pO1xuXG4gIHJldHVybiB0YWJsZURpcmVjdGl2ZXMucmVkdWNlKChhY2N1bXVsYXRvciwgbmV3ZGlyKSA9PiB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oYWNjdW11bGF0b3IsIG5ld2Rpcih7XG4gICAgICBzb3J0RmFjdG9yeSxcbiAgICAgIGZpbHRlckZhY3RvcnksXG4gICAgICBzZWFyY2hGYWN0b3J5LFxuICAgICAgdGFibGVTdGF0ZSxcbiAgICAgIGRhdGEsXG4gICAgICB0YWJsZTogY29yZVRhYmxlXG4gICAgfSkpO1xuICB9LCBjb3JlVGFibGUpO1xufSIsImltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuaW1wb3J0IGRhdGFTb3VyY2UgZnJvbSAnLi4vbGliL2RhdGFTb3VyY2UnO1xuaW1wb3J0IHtkZWZhdWx0IGFzIGNyZWF0ZVRhYmxlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuY29uc3QgZGF0YVNldCA9IFtcbiAge2lkOiAxfSxcbiAge2lkOiAyfSxcbiAge2lkOiAzfSxcbiAge2lkOiA0fSxcbiAge2lkOiA1fSxcbiAge2lkOiA2fSxcbiAge2lkOiA3fSxcbiAge2lkOiA4fVxuXTtcbmNvbnN0IGluaXRpYWxUYWJsZVN0YXRlID0ge1xuICBzZWFyY2g6IHt9LFxuICBmaWx0ZXI6IHt9LFxuICBzb3J0OiB7fSxcbiAgc2xpY2U6IHtzaXplOiAyLCBwYWdlOiAxfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KCdwdWxsIGRhdGEgZnJvbSBkYXRhIHNvdXJjZSBmcm9tIGFuIG9mZnNldCB0byBhIGdpdmVuIG51bWJlciBiYXNlZCBvbiB0aGUgcGFnZSBzaXplIGNvbmYnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgdGFibGUgPSBjcmVhdGVUYWJsZSh7ZGF0YTogZGF0YVNldCwgdGFibGVTdGF0ZTogaW5pdGlhbFRhYmxlU3RhdGV9KTtcbiAgICBjb25zdCBkYXRhID0gZGF0YVNvdXJjZSh7dGFibGV9KTtcbiAgICBjb25zdCBpdGVtcyA9IHlpZWxkIGRhdGEucHVsbCgxLCA0KTtcbiAgICB0LmRlZXBFcXVhbChpdGVtcywgW1xuICAgICAge2luZGV4OiAxLCB2YWx1ZToge2lkOiAyfX0sXG4gICAgICB7aW5kZXg6IDIsIHZhbHVlOiB7aWQ6IDN9fSxcbiAgICAgIHtpbmRleDogMywgdmFsdWU6IHtpZDogNH19LFxuICAgICAge2luZGV4OiA0LCB2YWx1ZToge2lkOiA1fX1cbiAgICBdKTtcbiAgfSk7XG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2J1ZmZlclNpemUgPSAxMDAwLCB3aW5kb3dTaXplID0gMjAwfSA9IHt9KSB7XG5cbiAgY29uc3QgZGF0YUxpc3QgPSBbXTtcbiAgbGV0IHdpbmRvd0N1cnNvciA9IG51bGw7XG5cbiAgY29uc3QgaW5zdGFuY2UgPSB7XG4gICAgcHVzaCgpe1xuICAgICAgY29uc3QgaXRlbXMgPSBbLi4uYXJndW1lbnRzXTtcbiAgICAgIGNvbnN0IG1heFJlbW92YWJsZUl0ZW1Db3VudCA9IE1hdGgubWluKGRhdGFMaXN0LmluZGV4T2Yod2luZG93Q3Vyc29yKSwgaXRlbXMubGVuZ3RoKTtcbiAgICAgIGNvbnN0IGxpbWl0ID0gZGF0YUxpc3QubGVuZ3RoIDwgYnVmZmVyU2l6ZSA/IGJ1ZmZlclNpemUgLSBkYXRhTGlzdC5sZW5ndGggOiBtYXhSZW1vdmFibGVJdGVtQ291bnQ7XG4gICAgICBjb25zdCB0b0FwcGVuZCA9IGl0ZW1zLnNsaWNlKDAsIGxpbWl0KTtcbiAgICAgIGNvbnN0IHRhaWxJdGVtID0gaW5zdGFuY2UudGFpbCgpO1xuICAgICAgY29uc3Qgc3RhcnRJbmRleCA9IHRhaWxJdGVtID8gdGFpbEl0ZW0uJCRpbmRleCArIDEgOiAwO1xuICAgICAgZGF0YUxpc3QucHVzaCguLi50b0FwcGVuZC5tYXAoKGl0ZW0sIG9mZnNldCkgPT4gT2JqZWN0LmFzc2lnbih7JCRpbmRleDogc3RhcnRJbmRleCArIG9mZnNldH0sIGl0ZW0pKSk7XG4gICAgICBpZiAoZGF0YUxpc3QubGVuZ3RoID4gYnVmZmVyU2l6ZSkge1xuICAgICAgICBjb25zdCB0b0Ryb3AgPSBkYXRhTGlzdC5zcGxpY2UoMCwgbGltaXQpO1xuICAgICAgICB0b0Ryb3AuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgICAgICBpZiAoaXRlbS5jbGVhbikge1xuICAgICAgICAgICAgaXRlbS5jbGVhbigpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgICB1bnNoaWZ0KCl7XG4gICAgICBjb25zdCBpdGVtcyA9IFsuLi5hcmd1bWVudHNdO1xuICAgICAgY29uc3QgdXBwZXJXaW5kb3dJbmRleCA9IE1hdGgubWluKGRhdGFMaXN0LmluZGV4T2Yod2luZG93Q3Vyc29yKSArIHdpbmRvd1NpemUsIGRhdGFMaXN0Lmxlbmd0aCAtIDEpO1xuICAgICAgY29uc3QgbWF4UmVtb3ZhYmxlSXRlbUNvdW50ID0gTWF0aC5taW4oZGF0YUxpc3QubGVuZ3RoIC0gdXBwZXJXaW5kb3dJbmRleCwgaXRlbXMubGVuZ3RoKTtcbiAgICAgIGNvbnN0IGxpbWl0ID0gZGF0YUxpc3QubGVuZ3RoIDwgYnVmZmVyU2l6ZSA/IGJ1ZmZlclNpemUgLSBkYXRhTGlzdC5sZW5ndGggOiBtYXhSZW1vdmFibGVJdGVtQ291bnQ7XG4gICAgICBjb25zdCB0b1ByZXBlbmQgPSBpdGVtcy5zbGljZSgwLCBsaW1pdCk7XG4gICAgICBjb25zdCBzdGFydEluZGV4ID0gaW5zdGFuY2UuaGVhZCgpLiQkaW5kZXggLSBsaW1pdDtcbiAgICAgIGRhdGFMaXN0LnVuc2hpZnQoLi4udG9QcmVwZW5kLm1hcCgoaXRlbSwgb2Zmc2V0KSA9PiBPYmplY3QuYXNzaWduKHskJGluZGV4OiBzdGFydEluZGV4ICsgb2Zmc2V0fSwgaXRlbSkpKTtcbiAgICAgIGlmIChkYXRhTGlzdC5sZW5ndGggPiBidWZmZXJTaXplKSB7XG4gICAgICAgIGNvbnN0IHRvRHJvcCA9IGRhdGFMaXN0LnNwbGljZSgtbGltaXQpO1xuICAgICAgICB0b0Ryb3AuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgICAgICBpZiAoaXRlbS5jbGVhbikge1xuICAgICAgICAgICAgaXRlbS5jbGVhbigpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBnZXQoaW5kZXgpe1xuICAgICAgcmV0dXJuIGRhdGFMaXN0LmZpbmQoaXRlbSA9PiBpdGVtLiQkaW5kZXggPT09IGluZGV4KTtcbiAgICB9LFxuICAgIGhlYWQoKXtcbiAgICAgIHJldHVybiBkYXRhTGlzdFswXSB8fCBudWxsO1xuICAgIH0sXG4gICAgdGFpbCgpe1xuICAgICAgcmV0dXJuIGRhdGFMaXN0Lmxlbmd0aCA/IGRhdGFMaXN0W2RhdGFMaXN0Lmxlbmd0aCAtIDFdIDogbnVsbDtcbiAgICB9LFxuICAgIHNsaWRlKG9mZnNldCl7XG4gICAgICBjb25zdCBjdXJzb3JJbmRleCA9IHdpbmRvd0N1cnNvciAhPT0gbnVsbCA/IGRhdGFMaXN0LmluZGV4T2Yod2luZG93Q3Vyc29yKSA6IDA7XG4gICAgICBjb25zdCBpbmRleCA9IE1hdGgubWF4KGN1cnNvckluZGV4ICsgb2Zmc2V0LCAwKTtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gaW5kZXggKyB3aW5kb3dTaXplID49IChidWZmZXJTaXplIC0gMSkgPyBidWZmZXJTaXplIC0gd2luZG93U2l6ZSA6IGluZGV4O1xuICAgICAgY29uc3Qgc2xpY2UgPSBkYXRhTGlzdC5zbGljZShzdGFydCwgc3RhcnQgKyB3aW5kb3dTaXplKTtcbiAgICAgIGNvbnN0IHNoaWZ0ID0gc3RhcnQgLSBjdXJzb3JJbmRleDtcbiAgICAgIHdpbmRvd0N1cnNvciA9IGRhdGFMaXN0W3N0YXJ0XTtcbiAgICAgIHJldHVybiB7c2xpY2UsIHNoaWZ0fTtcbiAgICB9LFxuICAgIHBvc2l0aW9uKCl7XG4gICAgICByZXR1cm4gKGRhdGFMaXN0LmluZGV4T2Yod2luZG93Q3Vyc29yKSArIDEpIC8gKGJ1ZmZlclNpemUgLSB3aW5kb3dTaXplKTtcbiAgICB9XG4gIH07XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGluc3RhbmNlLCAnbGVuZ3RoJywge1xuICAgIGdldCgpe1xuICAgICAgcmV0dXJuIGRhdGFMaXN0Lmxlbmd0aDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn0iLCJpbXBvcnQgem9yYSBmcm9tICd6b3JhJztcbmltcG9ydCBidWZmZXIgZnJvbSAnLi4vbGliL2J1ZmZlcmVkV2luZG93JztcbmltcG9ydCB7Z2l2ZU1lTn0gZnJvbSAnLi4vbGliL2hlbHBlcic7XG5cbmNvbnN0IGl0ZW1GYWN0b3J5ID0gKCkgPT4ge1xuXG4gIGxldCBjbGVhbmVkQ291bnQgPSAwO1xuXG4gIGNvbnN0IGZhY3RvcnkgPSAoaXRlbSkgPT4gT2JqZWN0LmFzc2lnbih7XG4gICAgY2xlYW4oKXtcbiAgICAgIGNsZWFuZWRDb3VudCsrO1xuICAgIH1cbiAgfSwgaXRlbSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGZhY3RvcnksICdjbGVhbmVkJywge1xuICAgIGdldCgpe1xuICAgICAgcmV0dXJuIGNsZWFuZWRDb3VudFxuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGZhY3Rvcnk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCB6b3JhKClcbiAgLnRlc3QoJ3B1c2ggbXVsdGlwbGUgaXRlbXMnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgZmFjdG9yeSA9IGl0ZW1GYWN0b3J5KCk7XG4gICAgY29uc3QgYiA9IGJ1ZmZlcih7YnVmZmVyU2l6ZTogMTAwLCB3aW5kb3dTaXplOiAyMH0pO1xuICAgIGNvbnN0IGl0ZW1zID0gWzIzMywgNDU1XS5tYXAoaWQgPT4gZmFjdG9yeSh7aWR9KSk7XG4gICAgYi5wdXNoKC4uLml0ZW1zKTtcbiAgICBiLnNsaWRlKDApO1xuICAgIHQuZXF1YWwoYi5sZW5ndGgsIDIpO1xuICAgIGl0ZW1zLmZvckVhY2goKGl0ZW0sIGluZGV4KSA9PiB7XG4gICAgICBjb25zdCBhY3R1YWwgPSBiLmdldChpbmRleCk7XG4gICAgICBjb25zdCBleHBlY3RlZCA9IGl0ZW1zW2luZGV4XTtcbiAgICAgIHQuZXF1YWwoYWN0dWFsLiQkaW5kZXgsIGluZGV4KTtcbiAgICAgIHQuZXF1YWwoYWN0dWFsLmlkLCBleHBlY3RlZC5pZCk7XG4gICAgfSk7XG4gICAgYi5wdXNoKGZhY3Rvcnkoe2lkOiAyMn0pKTtcbiAgICB0LmVxdWFsKGIuZ2V0KDIpLmlkLCAyMik7XG4gIH0pXG4gIC50ZXN0KCdzaGlmdCBleHRyYSBpdGVtIHdoZW4gcHVzaCBleGNlZWQgY2FwYWNpdHknLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgZmFjdG9yeSA9IGl0ZW1GYWN0b3J5KCk7XG4gICAgY29uc3QgYiA9IGJ1ZmZlcih7YnVmZmVyU2l6ZTogMTAwLCB3aW5kb3dTaXplOiAyMH0pO1xuICAgIGNvbnN0IGl0ZW1zID0gWy4uLmdpdmVNZU4oMTAwKV0ubWFwKChpZCkgPT4gKHtpZH0pKTtcbiAgICBiLnB1c2goLi4uaXRlbXMubWFwKGZhY3RvcnkpKTtcbiAgICBiLnNsaWRlKDUpO1xuICAgIHQuZXF1YWwoYi5sZW5ndGgsIDEwMCk7XG4gICAgYi5wdXNoKHtpZDogNjY2fSk7XG4gICAgdC5lcXVhbChiLmxlbmd0aCwgMTAwKTtcbiAgICB0LmVxdWFsKGIudGFpbCgpLmlkLCA2NjYpO1xuICAgIHQuZXF1YWwoYi5oZWFkKCkuaWQsIDEpO1xuICAgIHQuZXF1YWwoZmFjdG9yeS5jbGVhbmVkLCAxKTtcbiAgfSlcbiAgLnRlc3QoJ3NoaWZ0IGl0ZW1zIGtlZXBpbmcgd2luZG93IGN1cnNvciBjb25zdHJhaW50JywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGIgPSBidWZmZXIoe2J1ZmZlclNpemU6IDEwMCwgd2luZG93U2l6ZTogMjB9KTtcbiAgICBjb25zdCBmYWN0b3J5ID0gaXRlbUZhY3RvcnkoKTtcbiAgICBjb25zdCBpdGVtcyA9IFsuLi5naXZlTWVOKDEwMCldLm1hcCgoaWQpID0+ICh7aWR9KSk7XG4gICAgYi5wdXNoKC4uLml0ZW1zLm1hcChmYWN0b3J5KSk7XG4gICAgYi5zbGlkZSg0KTtcbiAgICB0LmVxdWFsKGIubGVuZ3RoLCAxMDApO1xuICAgIGNvbnN0IG5ld0l0ZW1zID0gWy4uLmdpdmVNZU4oMTApXS5tYXAoaWQgPT4gKHtpZDogNjAwICsgaWR9KSk7XG4gICAgYi5wdXNoKC4uLm5ld0l0ZW1zKTtcbiAgICB0LmVxdWFsKGIubGVuZ3RoLCAxMDApO1xuICAgIHQuZXF1YWwoYi50YWlsKCkuaWQsIDYwMyk7XG4gICAgdC5lcXVhbChiLmhlYWQoKS5pZCwgNCk7XG4gICAgdC5lcXVhbChmYWN0b3J5LmNsZWFuZWQsIDQpO1xuICB9KVxuICAudGVzdCgnbW92ZSB3aW5kb3cgdXAgbWF4aW11bSB0byBmaXQgaW50byBidWZmZXInLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgZmFjdG9yeSA9IGl0ZW1GYWN0b3J5KCk7XG4gICAgY29uc3QgYiA9IGJ1ZmZlcih7YnVmZmVyU2l6ZTogMTAwLCB3aW5kb3dTaXplOiAyMH0pO1xuICAgIGNvbnN0IGl0ZW1zID0gWy4uLmdpdmVNZU4oMTAwKV0ubWFwKChpZCkgPT4gKHtpZH0pKTtcbiAgICBiLnB1c2goLi4uaXRlbXMubWFwKGZhY3RvcnkpKTtcbiAgICBjb25zdCB7c2xpY2UsIHNoaWZ0fSA9IGIuc2xpZGUoOTApO1xuICAgIHQuZXF1YWwoc2xpY2UubGVuZ3RoLCAyMCk7XG4gICAgdC5lcXVhbChzbGljZVsxOV0uaWQsIDk5KTtcbiAgICB0LmVxdWFsKHNsaWNlWzBdLmlkLCA4MCk7XG4gICAgdC5lcXVhbChzaGlmdCwgODApO1xuICB9KVxuICAudGVzdCgnbW92ZSB3aW5kb3cgZG93biBtYXhpbXVtIHRvIGZpdCBpbnRvIGJ1ZmZlcicsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBmYWN0b3J5ID0gaXRlbUZhY3RvcnkoKTtcbiAgICBjb25zdCBiID0gYnVmZmVyKHtidWZmZXJTaXplOiAxMDAsIHdpbmRvd1NpemU6IDIwfSk7XG4gICAgY29uc3QgaXRlbXMgPSBbLi4uZ2l2ZU1lTigxMDApXS5tYXAoKGlkKSA9PiAoe2lkfSkpO1xuICAgIGIucHVzaCguLi5pdGVtcy5tYXAoZmFjdG9yeSkpO1xuICAgIGNvbnN0IHtzbGljZSwgc2hpZnR9ID0gYi5zbGlkZSg1MCk7XG4gICAgdC5lcXVhbChzbGljZVsxOV0uaWQsIDY5KTtcbiAgICB0LmVxdWFsKHNsaWNlWzBdLmlkLCA1MCk7XG4gICAgdC5lcXVhbChzaGlmdCwgNTApO1xuICAgIGNvbnN0IHtzbGljZTpzbCwgc2hpZnQ6c2h9ID0gYi5zbGlkZSgtMTAwKTtcbiAgICB0LmVxdWFsKHNsLmxlbmd0aCwgMjApO1xuICAgIHQuZXF1YWwoc2xbMF0uaWQsIDApO1xuICAgIHQuZXF1YWwoc2xbMTldLmlkLCAxOSk7XG4gICAgdC5lcXVhbChzaCwgLTUwKTtcbiAgfSkiLCJpbXBvcnQge2RvTlRpbWVzfSBmcm9tICcuL2hlbHBlcidcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtlbGVtZW50LCB3aW5kb3dTaXplfSkge1xuXG4gIGNvbnN0IGluc3RhbmNlID0ge1xuICAgIGFwcGVuZCguLi5hcmdzKXtcbiAgICAgIGZvciAobGV0IGl0ZW0gb2YgYXJncykge1xuICAgICAgICBlbGVtZW50LmFwcGVuZENoaWxkKGl0ZW0pO1xuICAgICAgICBpZiAoaW5zdGFuY2UubGVuZ3RoID4gd2luZG93U2l6ZSkge1xuICAgICAgICAgIGluc3RhbmNlLmRyb3BCZWdpbihpbnN0YW5jZS5sZW5ndGggLSB3aW5kb3dTaXplKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgcHJlcGVuZCguLi5hcmdzKXtcbiAgICAgIGZvciAobGV0IGl0ZW0gb2YgYXJncykge1xuICAgICAgICBlbGVtZW50Lmluc2VydEJlZm9yZShpdGVtLCBlbGVtZW50LmZpcnN0Q2hpbGQpO1xuICAgICAgICBpZiAoaW5zdGFuY2UubGVuZ3RoID4gd2luZG93U2l6ZSkge1xuICAgICAgICAgIGluc3RhbmNlLmRyb3BFbmQoaW5zdGFuY2UubGVuZ3RoIC0gd2luZG93U2l6ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGRyb3BCZWdpbjogZG9OVGltZXMoKCkgPT4ge1xuICAgICAgY29uc3QgZmlyc3RDaGlsZCA9IGVsZW1lbnQuZmlyc3RDaGlsZDtcbiAgICAgIGlmIChmaXJzdENoaWxkKSB7XG4gICAgICAgIGZpcnN0Q2hpbGQucmVtb3ZlKCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgZHJvcEVuZDogZG9OVGltZXMoKCkgPT4ge1xuICAgICAgY29uc3QgbGFzdENoaWxkID0gZWxlbWVudC5sYXN0Q2hpbGQ7XG4gICAgICBpZiAobGFzdENoaWxkKSB7XG4gICAgICAgIGxhc3RDaGlsZC5yZW1vdmUoKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICBlbXB0eSgpe1xuICAgICAgZWxlbWVudC5pbm5lckhUTUwgPSAnJztcbiAgICB9XG4gIH07XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGluc3RhbmNlLCAnbGVuZ3RoJywge1xuICAgIGdldCgpe1xuICAgICAgcmV0dXJuIGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufSIsImltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuaW1wb3J0IGNvbnRhaW5lciBmcm9tICcuLi9saWIvY29udGFpbmVyJztcblxuZnVuY3Rpb24gZ2V0RWxlbWVudCAoKSB7XG4gIHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd1bCcpO1xufVxuXG5mdW5jdGlvbiBsaSAoaWQpIHtcbiAgY29uc3QgbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XG4gIGwuaWQgPSBpZDtcbiAgcmV0dXJuIGw7XG59XG5cbmZ1bmN0aW9uIHRlc3RFbGVtZW50IChlbCwgZXhwZWN0ZWQsIGFzc2VydCkge1xuICBjb25zdCBjaGlsZHJlbiA9IEFycmF5LmZyb20oZWwuY2hpbGRyZW4pO1xuICBjaGlsZHJlbi5mb3JFYWNoKChjaGlsZCwgaW5kZXgpID0+IHtcbiAgICBhc3NlcnQuZXF1YWwoY2hpbGQuaWQsIGV4cGVjdGVkW2luZGV4XS50b1N0cmluZygpKTtcbiAgfSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnYXBwZW5kIG4gZWxlbWVudHMgYWZ0ZXInLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgZWxlbWVudCA9IGdldEVsZW1lbnQoKTtcbiAgICBjb25zdCBjID0gY29udGFpbmVyKHtlbGVtZW50LCB3aW5kb3dTaXplOiA1fSk7XG4gICAgYy5hcHBlbmQobGkoMCkpO1xuICAgIHRlc3RFbGVtZW50KGVsZW1lbnQsIFswXSwgdCk7XG4gICAgYy5hcHBlbmQoLi4uWzEsIDIsIDMsIDRdLm1hcChsaSkpO1xuICAgIHRlc3RFbGVtZW50KGVsZW1lbnQsIFswLCAxLCAyLCAzLCA0XSwgdCk7XG4gIH0pXG4gIC50ZXN0KCdhcHBlbmQ6IGRyb3AgZWxlbWVudCBpZiBvdmVyIHdpbmRvdyBzaXplJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBnZXRFbGVtZW50KCk7XG4gICAgY29uc3QgYyA9IGNvbnRhaW5lcih7ZWxlbWVudCwgd2luZG93U2l6ZTogNX0pO1xuICAgIGMuYXBwZW5kKGxpKDApKTtcbiAgICB0ZXN0RWxlbWVudChlbGVtZW50LCBbMF0sIHQpO1xuICAgIGMuYXBwZW5kKC4uLlsxLCAyLCAzLCA0LCA1LCA2XS5tYXAobGkpKTtcbiAgICB0ZXN0RWxlbWVudChlbGVtZW50LCBbMiwgMywgNCwgNSwgNl0sIHQpO1xuICB9KVxuICAudGVzdCgncHJlcGVuZCBuIGVsZW1lbnRzIGJlZm9yZScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gZ2V0RWxlbWVudCgpO1xuICAgIGNvbnN0IGMgPSBjb250YWluZXIoe2VsZW1lbnQsIHdpbmRvd1NpemU6IDV9KTtcbiAgICBjLmFwcGVuZChsaSgwKSk7XG4gICAgdGVzdEVsZW1lbnQoZWxlbWVudCwgWzBdLCB0KTtcbiAgICBjLnByZXBlbmQoLi4uWzQsIDMsIDIsIDFdLm1hcChsaSkpO1xuICAgIHRlc3RFbGVtZW50KGVsZW1lbnQsIFsxLCAyLCAzLCA0LCAwXSwgdCk7XG4gIH0pXG4gIC50ZXN0KCdwcmVwZW5kOiBkcm9wIGVsZW1lbnQgaWYgb3ZlciB3aW5kb3cgc2l6ZScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gZ2V0RWxlbWVudCgpO1xuICAgIGNvbnN0IGMgPSBjb250YWluZXIoe2VsZW1lbnQsIHdpbmRvd1NpemU6IDV9KTtcbiAgICBjLmFwcGVuZChsaSgwKSk7XG4gICAgdGVzdEVsZW1lbnQoZWxlbWVudCwgWzBdLCB0KTtcbiAgICBjLnByZXBlbmQoLi4uWzYsIDUsIDQsIDMsIDIsIDFdLm1hcChsaSkpO1xuICAgIHRlc3RFbGVtZW50KGVsZW1lbnQsIFsxLCAyLCAzLCA0LCA1XSwgdCk7XG4gIH0pIiwiaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5pbXBvcnQgaGVscGVyIGZyb20gJy4vaGVscGVyJztcbmltcG9ydCBkYXRhU291cmNlIGZyb20gJy4vZGF0YVNvdXJjZSc7XG5pbXBvcnQgYnVmZmVyIGZyb20gJy4vaXRlbXNCdWZmZXInO1xuaW1wb3J0IGNvbnRhaW5lciBmcm9tICcuL2NvbnRhaW5lcic7XG5cbnpvcmEoKVxuICAudGVzdChoZWxwZXIpXG4gIC50ZXN0KGJ1ZmZlcilcbiAgLnRlc3QoZGF0YVNvdXJjZSlcbiAgLnRlc3QoY29udGFpbmVyKVxuICAucnVuKCk7Il0sIm5hbWVzIjpbInBsYW4iLCJ6b3JhIiwic3dhcCIsImNvbXBvc2UiLCJjdXJyeSIsInRhcCIsInBvaW50ZXIiLCJmaWx0ZXIiLCJzb3J0RmFjdG9yeSIsInNvcnQiLCJzZWFyY2giLCJ0YWJsZSIsImNyZWF0ZVRhYmxlIiwiZGF0YVNvdXJjZSIsImJ1ZmZlciIsImNvbnRhaW5lciJdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7Ozs7QUFJQSxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQzs7Ozs7O0FBTWxDLElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7QUFjdkMsRUFBRSxDQUFDLElBQUksR0FBRyxVQUFVLEVBQUUsRUFBRTtFQUN0QixhQUFhLENBQUMscUJBQXFCLEdBQUcsRUFBRSxDQUFDO0VBQ3pDLE9BQU8sYUFBYSxDQUFDO0VBQ3JCLFNBQVMsYUFBYSxHQUFHO0lBQ3ZCLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztHQUNqRDtDQUNGLENBQUM7Ozs7Ozs7Ozs7O0FBV0YsU0FBUyxFQUFFLENBQUMsR0FBRyxFQUFFO0VBQ2YsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDO0VBQ2YsSUFBSSxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7Ozs7O0VBS3BDLE9BQU8sSUFBSSxPQUFPLENBQUMsU0FBUyxPQUFPLEVBQUUsTUFBTSxFQUFFO0lBQzNDLElBQUksT0FBTyxHQUFHLEtBQUssVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMxRCxJQUFJLENBQUMsR0FBRyxJQUFJLE9BQU8sR0FBRyxDQUFDLElBQUksS0FBSyxVQUFVLEVBQUUsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7O0lBRWhFLFdBQVcsRUFBRSxDQUFDOzs7Ozs7OztJQVFkLFNBQVMsV0FBVyxDQUFD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

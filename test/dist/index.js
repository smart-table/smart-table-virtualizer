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

const eventuallyDo = (fn, val) => {
  if (val) {
    fn(val);
  }
};

var buffer = function ({capacity = 1000} = {}) {
  const arrayBuffer = [];
  const instance = {
    pop: doNTimes(() => {
      eventuallyDo((item) => item.row.clean(), arrayBuffer.pop());
    }),
    shift: doNTimes(() => {
      eventuallyDo((item) => item.row.clean(), arrayBuffer.shift());
    }),
    unshift(){
      arrayBuffer.unshift(...arguments);
      eventuallyDo(instance.pop, Math.max(arrayBuffer.length - capacity, 0));
    },
    push(){
      arrayBuffer.push(...arguments);
      eventuallyDo(instance.shift, Math.max(arrayBuffer.length - capacity, 0));
    },
    get(index){
      return arrayBuffer.find(item => item.index === index);
    },
    slice: function * (start, n) {
      for (let i = 0; i < n; i++) {
        const item = instance.get(start + i);
        if (item) {
          yield item;
        }
      }
    },
    head(){
      return arrayBuffer[0];
    },
    tail(){
      return arrayBuffer[arrayBuffer.length - 1];
    },
    position(index){
      return arrayBuffer.indexOf(instance.get(index)) / arrayBuffer.length;
    }
  };

  Object.defineProperty(instance, 'length', {
    get: () => arrayBuffer.length
  });

  return instance;
};

const itemFactory = (item) => {

  let cleaned = false;

  const row = {
    clean(){
      cleaned = true;
    }
  };

  Object.defineProperty(row, 'cleaned', {
    get(){
      return cleaned;
    }
  });

  return {
    row,
    id:item.id
  };
};

plan$1()
  .test('clean item when pop', function * (t) {
    const b = buffer();
    const item = itemFactory({id: 666});
    b.push(item);
    t.equal(b.length, 1);
    t.equal(item.row.cleaned, false);
    b.pop();
    t.equal(b.length, 0);
    t.equal(item.row.cleaned, true);
  })
  .test('clean item when shift', function * (t) {
    const b = buffer();
    const item = itemFactory({id: 666});
    b.push(item);
    t.equal(b.length, 1);
    t.equal(item.row.cleaned, false);
    b.shift();
    t.equal(b.length, 0);
    t.equal(item.row.cleaned, true);
  })
  .test('push multiple items', function * (t) {
    const b = buffer();
    const items = [233, 455].map(id => itemFactory({id}));
    b.push(...items);
    t.equal(b.length, 2);
    items.forEach((item, index) => {
      t.deepEqual(b.get(index), items[index]);
    });
  })
  .test('unshift multiple items', function * (t) {
    const b = buffer();
    const items = [233, 455].map(id => itemFactory({id}));
    b.unshift(...items);
    t.equal(b.length, 2);
    items.forEach((item, index) => {
      t.deepEqual(b.get(index), items[index]);
    });
  })
  .test('shift extra item when push exceed capacity', function * (t) {
    const b = buffer({capacity: 1});
    const item1 = itemFactory({id: 1});
    const item2 = itemFactory({id: 2});
    b.push(item1);
    t.equal(b.length, 1);
    b.push(item2);
    t.equal(b.length, 1);
    t.equal(b.get(0), item2);
  })
  .test('pop extra item when unshift exceed capacity', function * (t) {
    const b = buffer({capacity: 1});
    const item1 = itemFactory({id: 1});
    const item2 = itemFactory({id: 2});
    b.unshift(item1);
    t.equal(b.length, 1);
    b.unshift(item2);
    t.equal(b.length, 1);
    t.equal(b.get(0), item2);
  })

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

var slidingWindow$1 = function ({bufferSize = 600, windowSize = 200, indexKey = '$$index'} = {}) {

  const dataList = [];
  let windowCursor = null;


  const instance = {
    //return a window
    slide(offset){

    },
    push(){
      const items = [...arguments];
      const tailItem = instance.tail();
      const index = tailItem ? tailItem[indexKey] + 1 : 0;
      dataList.push(...items.map((item, offset) => Object.assign({[indexKey]: index + offset}, item)));
    },
    unshift(...items){
      const items = [...arguments];
      const index = instance.length ? instance.length : 0;
      dataList.push(...items.map((item, offset) => Object.assign({[indexKey]: index + offset}, item)));
    },
    get(index){
      return dataList.find(item => item[indexKey] === index);
    },
    shift(count){
    },
    pop(count){
    },
    head(){
      return dataList[0] || null;
    },
    tail(){
      return instance.length ? dataList[instance.length - 1] : null;
    },
    slice(){
    }

  };

  Object.defineProperty(instance, 'length', {
    get(){
      return dataList.length;
    }
  });


  return instance;


};

var slidingWindow = plan$1()
  .test('sliding window: push new items setting indexes', function * (t) {
    const entries = Array.from(giveMeN(5)).map(i => Object.assign({}, {id: i}));
    const w = slidingWindow$1();
    w.push(...entries);
    t.equal(w.length, 5);
    t.deepEqual(w.get(2), {$$index: 2, id: 2});
    w.push({id: 666});
    t.deepEqual(w.get(5), {$$index: 5, id: 666});
  })
  .test('tail should return the last item or null', function * (t) {
    const w = slidingWindow$1();
    t.equal(w.tail(), null);
    w.push({id: 1}, {id: 2});
    t.deepEqual(w.tail(), {$$index: 1, id: 2});
  })
  .test('head should return the first item or null', function * (t) {
    const w = slidingWindow$1();
    t.equal(w.head(), null);
    w.push({id: 1}, {id: 2});
    t.deepEqual(w.head(), {$$index: 0, id: 1});
  });

plan$1()
  .test(helper)
  // .test(buffer)
  .test(dataSource)
  .test(slidingWindow)
  .run();

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uLy4uL25vZGVfbW9kdWxlcy96b3JhL2Rpc3Qvem9yYS5lcy5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1vcGVyYXRvcnMvaW5kZXguanMiLCIuLi8uLi9saWIvaGVscGVyLmpzIiwiLi4vaGVscGVyLmpzIiwiLi4vLi4vbGliL2l0ZW1zQnVmZmVyLmpzIiwiLi4vaXRlbXNCdWZmZXIuanMiLCIuLi8uLi9saWIvZGF0YVNvdXJjZS5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1vcGVyYXRvcnMvaW5kZXguanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtanNvbi1wb2ludGVyL2luZGV4LmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLXNvcnQvaW5kZXguanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZmlsdGVyL2luZGV4LmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLXNlYXJjaC9pbmRleC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9zbGljZS5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1ldmVudHMvaW5kZXguanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZXZlbnRzLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvdGFibGUuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvdGFibGUuanMiLCIuLi9kYXRhU291cmNlLmpzIiwiLi4vLi4vbGliL3NsaWRpbmdXaW5kb3cuanMiLCIuLi9zbGlkaW5nV2luZG93LmpzIiwiLi4vaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBzbGljZSgpIHJlZmVyZW5jZS5cbiAqL1xuXG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG5cbi8qKlxuICogRXhwb3NlIGBjb2AuXG4gKi9cblxudmFyIGluZGV4ID0gY29bJ2RlZmF1bHQnXSA9IGNvLmNvID0gY287XG5cbi8qKlxuICogV3JhcCB0aGUgZ2l2ZW4gZ2VuZXJhdG9yIGBmbmAgaW50byBhXG4gKiBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBwcm9taXNlLlxuICogVGhpcyBpcyBhIHNlcGFyYXRlIGZ1bmN0aW9uIHNvIHRoYXRcbiAqIGV2ZXJ5IGBjbygpYCBjYWxsIGRvZXNuJ3QgY3JlYXRlIGEgbmV3LFxuICogdW5uZWNlc3NhcnkgY2xvc3VyZS5cbiAqXG4gKiBAcGFyYW0ge0dlbmVyYXRvckZ1bmN0aW9ufSBmblxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmNvLndyYXAgPSBmdW5jdGlvbiAoZm4pIHtcbiAgY3JlYXRlUHJvbWlzZS5fX2dlbmVyYXRvckZ1bmN0aW9uX18gPSBmbjtcbiAgcmV0dXJuIGNyZWF0ZVByb21pc2U7XG4gIGZ1bmN0aW9uIGNyZWF0ZVByb21pc2UoKSB7XG4gICAgcmV0dXJuIGNvLmNhbGwodGhpcywgZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKSk7XG4gIH1cbn07XG5cbi8qKlxuICogRXhlY3V0ZSB0aGUgZ2VuZXJhdG9yIGZ1bmN0aW9uIG9yIGEgZ2VuZXJhdG9yXG4gKiBhbmQgcmV0dXJuIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gY28oZ2VuKSB7XG4gIHZhciBjdHggPSB0aGlzO1xuICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAvLyB3ZSB3cmFwIGV2ZXJ5dGhpbmcgaW4gYSBwcm9taXNlIHRvIGF2b2lkIHByb21pc2UgY2hhaW5pbmcsXG4gIC8vIHdoaWNoIGxlYWRzIHRvIG1lbW9yeSBsZWFrIGVycm9ycy5cbiAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS90ai9jby9pc3N1ZXMvMTgwXG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICBpZiAodHlwZW9mIGdlbiA9PT0gJ2Z1bmN0aW9uJykgZ2VuID0gZ2VuLmFwcGx5KGN0eCwgYXJncyk7XG4gICAgaWYgKCFnZW4gfHwgdHlwZW9mIGdlbi5uZXh0ICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gcmVzb2x2ZShnZW4pO1xuXG4gICAgb25GdWxmaWxsZWQoKTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7TWl4ZWR9IHJlc1xuICAgICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAgICogQGFwaSBwcml2YXRlXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBvbkZ1bGZpbGxlZChyZXMpIHtcbiAgICAgIHZhciByZXQ7XG4gICAgICB0cnkge1xuICAgICAgICByZXQgPSBnZW4ubmV4dChyZXMpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KGUpO1xuICAgICAgfVxuICAgICAgbmV4dChyZXQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RXJyb3J9IGVyclxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAgICogQGFwaSBwcml2YXRlXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBvblJlamVjdGVkKGVycikge1xuICAgICAgdmFyIHJldDtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldCA9IGdlbi50aHJvdyhlcnIpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KGUpO1xuICAgICAgfVxuICAgICAgbmV4dChyZXQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgbmV4dCB2YWx1ZSBpbiB0aGUgZ2VuZXJhdG9yLFxuICAgICAqIHJldHVybiBhIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcmV0XG4gICAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICAgKiBAYXBpIHByaXZhdGVcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIG5leHQocmV0KSB7XG4gICAgICBpZiAocmV0LmRvbmUpIHJldHVybiByZXNvbHZlKHJldC52YWx1ZSk7XG4gICAgICB2YXIgdmFsdWUgPSB0b1Byb21pc2UuY2FsbChjdHgsIHJldC52YWx1ZSk7XG4gICAgICBpZiAodmFsdWUgJiYgaXNQcm9taXNlKHZhbHVlKSkgcmV0dXJuIHZhbHVlLnRoZW4ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpO1xuICAgICAgcmV0dXJuIG9uUmVqZWN0ZWQobmV3IFR5cGVFcnJvcignWW91IG1heSBvbmx5IHlpZWxkIGEgZnVuY3Rpb24sIHByb21pc2UsIGdlbmVyYXRvciwgYXJyYXksIG9yIG9iamVjdCwgJ1xuICAgICAgICArICdidXQgdGhlIGZvbGxvd2luZyBvYmplY3Qgd2FzIHBhc3NlZDogXCInICsgU3RyaW5nKHJldC52YWx1ZSkgKyAnXCInKSk7XG4gICAgfVxuICB9KTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEgYHlpZWxkYGVkIHZhbHVlIGludG8gYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IG9ialxuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHRvUHJvbWlzZShvYmopIHtcbiAgaWYgKCFvYmopIHJldHVybiBvYmo7XG4gIGlmIChpc1Byb21pc2Uob2JqKSkgcmV0dXJuIG9iajtcbiAgaWYgKGlzR2VuZXJhdG9yRnVuY3Rpb24ob2JqKSB8fCBpc0dlbmVyYXRvcihvYmopKSByZXR1cm4gY28uY2FsbCh0aGlzLCBvYmopO1xuICBpZiAoJ2Z1bmN0aW9uJyA9PSB0eXBlb2Ygb2JqKSByZXR1cm4gdGh1bmtUb1Byb21pc2UuY2FsbCh0aGlzLCBvYmopO1xuICBpZiAoQXJyYXkuaXNBcnJheShvYmopKSByZXR1cm4gYXJyYXlUb1Byb21pc2UuY2FsbCh0aGlzLCBvYmopO1xuICBpZiAoaXNPYmplY3Qob2JqKSkgcmV0dXJuIG9iamVjdFRvUHJvbWlzZS5jYWxsKHRoaXMsIG9iaik7XG4gIHJldHVybiBvYmo7XG59XG5cbi8qKlxuICogQ29udmVydCBhIHRodW5rIHRvIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufVxuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHRodW5rVG9Qcm9taXNlKGZuKSB7XG4gIHZhciBjdHggPSB0aGlzO1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgIGZuLmNhbGwoY3R4LCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgIGlmIChlcnIpIHJldHVybiByZWplY3QoZXJyKTtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikgcmVzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgcmVzb2x2ZShyZXMpO1xuICAgIH0pO1xuICB9KTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGFuIGFycmF5IG9mIFwieWllbGRhYmxlc1wiIHRvIGEgcHJvbWlzZS5cbiAqIFVzZXMgYFByb21pc2UuYWxsKClgIGludGVybmFsbHkuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gb2JqXG4gKiBAcmV0dXJuIHtQcm9taXNlfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gYXJyYXlUb1Byb21pc2Uob2JqKSB7XG4gIHJldHVybiBQcm9taXNlLmFsbChvYmoubWFwKHRvUHJvbWlzZSwgdGhpcykpO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYW4gb2JqZWN0IG9mIFwieWllbGRhYmxlc1wiIHRvIGEgcHJvbWlzZS5cbiAqIFVzZXMgYFByb21pc2UuYWxsKClgIGludGVybmFsbHkuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIG9iamVjdFRvUHJvbWlzZShvYmope1xuICB2YXIgcmVzdWx0cyA9IG5ldyBvYmouY29uc3RydWN0b3IoKTtcbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICB2YXIgcHJvbWlzZXMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgdmFyIHByb21pc2UgPSB0b1Byb21pc2UuY2FsbCh0aGlzLCBvYmpba2V5XSk7XG4gICAgaWYgKHByb21pc2UgJiYgaXNQcm9taXNlKHByb21pc2UpKSBkZWZlcihwcm9taXNlLCBrZXkpO1xuICAgIGVsc2UgcmVzdWx0c1trZXldID0gb2JqW2tleV07XG4gIH1cbiAgcmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfSk7XG5cbiAgZnVuY3Rpb24gZGVmZXIocHJvbWlzZSwga2V5KSB7XG4gICAgLy8gcHJlZGVmaW5lIHRoZSBrZXkgaW4gdGhlIHJlc3VsdFxuICAgIHJlc3VsdHNba2V5XSA9IHVuZGVmaW5lZDtcbiAgICBwcm9taXNlcy5wdXNoKHByb21pc2UudGhlbihmdW5jdGlvbiAocmVzKSB7XG4gICAgICByZXN1bHRzW2tleV0gPSByZXM7XG4gICAgfSkpO1xuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYG9iamAgaXMgYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBpc1Byb21pc2Uob2JqKSB7XG4gIHJldHVybiAnZnVuY3Rpb24nID09IHR5cGVvZiBvYmoudGhlbjtcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBgb2JqYCBpcyBhIGdlbmVyYXRvci5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmpcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBpc0dlbmVyYXRvcihvYmopIHtcbiAgcmV0dXJuICdmdW5jdGlvbicgPT0gdHlwZW9mIG9iai5uZXh0ICYmICdmdW5jdGlvbicgPT0gdHlwZW9mIG9iai50aHJvdztcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBgb2JqYCBpcyBhIGdlbmVyYXRvciBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmpcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gaXNHZW5lcmF0b3JGdW5jdGlvbihvYmopIHtcbiAgdmFyIGNvbnN0cnVjdG9yID0gb2JqLmNvbnN0cnVjdG9yO1xuICBpZiAoIWNvbnN0cnVjdG9yKSByZXR1cm4gZmFsc2U7XG4gIGlmICgnR2VuZXJhdG9yRnVuY3Rpb24nID09PSBjb25zdHJ1Y3Rvci5uYW1lIHx8ICdHZW5lcmF0b3JGdW5jdGlvbicgPT09IGNvbnN0cnVjdG9yLmRpc3BsYXlOYW1lKSByZXR1cm4gdHJ1ZTtcbiAgcmV0dXJuIGlzR2VuZXJhdG9yKGNvbnN0cnVjdG9yLnByb3RvdHlwZSk7XG59XG5cbi8qKlxuICogQ2hlY2sgZm9yIHBsYWluIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSB2YWxcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBpc09iamVjdCh2YWwpIHtcbiAgcmV0dXJuIE9iamVjdCA9PSB2YWwuY29uc3RydWN0b3I7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZuLCBtb2R1bGUpIHtcblx0cmV0dXJuIG1vZHVsZSA9IHsgZXhwb3J0czoge30gfSwgZm4obW9kdWxlLCBtb2R1bGUuZXhwb3J0cyksIG1vZHVsZS5leHBvcnRzO1xufVxuXG52YXIga2V5cyA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHR5cGVvZiBPYmplY3Qua2V5cyA9PT0gJ2Z1bmN0aW9uJ1xuICA/IE9iamVjdC5rZXlzIDogc2hpbTtcblxuZXhwb3J0cy5zaGltID0gc2hpbTtcbmZ1bmN0aW9uIHNoaW0gKG9iaikge1xuICB2YXIga2V5cyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSBrZXlzLnB1c2goa2V5KTtcbiAgcmV0dXJuIGtleXM7XG59XG59KTtcblxudmFyIGlzX2FyZ3VtZW50cyA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcbnZhciBzdXBwb3J0c0FyZ3VtZW50c0NsYXNzID0gKGZ1bmN0aW9uKCl7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYXJndW1lbnRzKVxufSkoKSA9PSAnW29iamVjdCBBcmd1bWVudHNdJztcblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gc3VwcG9ydHNBcmd1bWVudHNDbGFzcyA/IHN1cHBvcnRlZCA6IHVuc3VwcG9ydGVkO1xuXG5leHBvcnRzLnN1cHBvcnRlZCA9IHN1cHBvcnRlZDtcbmZ1bmN0aW9uIHN1cHBvcnRlZChvYmplY3QpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmplY3QpID09ICdbb2JqZWN0IEFyZ3VtZW50c10nO1xufVxuXG5leHBvcnRzLnVuc3VwcG9ydGVkID0gdW5zdXBwb3J0ZWQ7XG5mdW5jdGlvbiB1bnN1cHBvcnRlZChvYmplY3Qpe1xuICByZXR1cm4gb2JqZWN0ICYmXG4gICAgdHlwZW9mIG9iamVjdCA9PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiBvYmplY3QubGVuZ3RoID09ICdudW1iZXInICYmXG4gICAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgJ2NhbGxlZScpICYmXG4gICAgIU9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChvYmplY3QsICdjYWxsZWUnKSB8fFxuICAgIGZhbHNlO1xufVxufSk7XG5cbnZhciBpbmRleCQxID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSkge1xudmFyIHBTbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbnZhciBvYmplY3RLZXlzID0ga2V5cztcbnZhciBpc0FyZ3VtZW50cyA9IGlzX2FyZ3VtZW50cztcblxudmFyIGRlZXBFcXVhbCA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG9wdHMpIHtcbiAgaWYgKCFvcHRzKSBvcHRzID0ge307XG4gIC8vIDcuMS4gQWxsIGlkZW50aWNhbCB2YWx1ZXMgYXJlIGVxdWl2YWxlbnQsIGFzIGRldGVybWluZWQgYnkgPT09LlxuICBpZiAoYWN0dWFsID09PSBleHBlY3RlZCkge1xuICAgIHJldHVybiB0cnVlO1xuXG4gIH0gZWxzZSBpZiAoYWN0dWFsIGluc3RhbmNlb2YgRGF0ZSAmJiBleHBlY3RlZCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICByZXR1cm4gYWN0dWFsLmdldFRpbWUoKSA9PT0gZXhwZWN0ZWQuZ2V0VGltZSgpO1xuXG4gIC8vIDcuMy4gT3RoZXIgcGFpcnMgdGhhdCBkbyBub3QgYm90aCBwYXNzIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyxcbiAgLy8gZXF1aXZhbGVuY2UgaXMgZGV0ZXJtaW5lZCBieSA9PS5cbiAgfSBlbHNlIGlmICghYWN0dWFsIHx8ICFleHBlY3RlZCB8fCB0eXBlb2YgYWN0dWFsICE9ICdvYmplY3QnICYmIHR5cGVvZiBleHBlY3RlZCAhPSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBvcHRzLnN0cmljdCA/IGFjdHVhbCA9PT0gZXhwZWN0ZWQgOiBhY3R1YWwgPT0gZXhwZWN0ZWQ7XG5cbiAgLy8gNy40LiBGb3IgYWxsIG90aGVyIE9iamVjdCBwYWlycywgaW5jbHVkaW5nIEFycmF5IG9iamVjdHMsIGVxdWl2YWxlbmNlIGlzXG4gIC8vIGRldGVybWluZWQgYnkgaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChhcyB2ZXJpZmllZFxuICAvLyB3aXRoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCksIHRoZSBzYW1lIHNldCBvZiBrZXlzXG4gIC8vIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLCBlcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnlcbiAgLy8gY29ycmVzcG9uZGluZyBrZXksIGFuZCBhbiBpZGVudGljYWwgJ3Byb3RvdHlwZScgcHJvcGVydHkuIE5vdGU6IHRoaXNcbiAgLy8gYWNjb3VudHMgZm9yIGJvdGggbmFtZWQgYW5kIGluZGV4ZWQgcHJvcGVydGllcyBvbiBBcnJheXMuXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG9iakVxdWl2KGFjdHVhbCwgZXhwZWN0ZWQsIG9wdHMpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZE9yTnVsbCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gaXNCdWZmZXIgKHgpIHtcbiAgaWYgKCF4IHx8IHR5cGVvZiB4ICE9PSAnb2JqZWN0JyB8fCB0eXBlb2YgeC5sZW5ndGggIT09ICdudW1iZXInKSByZXR1cm4gZmFsc2U7XG4gIGlmICh0eXBlb2YgeC5jb3B5ICE9PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiB4LnNsaWNlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh4Lmxlbmd0aCA+IDAgJiYgdHlwZW9mIHhbMF0gIT09ICdudW1iZXInKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBvYmpFcXVpdihhLCBiLCBvcHRzKSB7XG4gIHZhciBpLCBrZXk7XG4gIGlmIChpc1VuZGVmaW5lZE9yTnVsbChhKSB8fCBpc1VuZGVmaW5lZE9yTnVsbChiKSlcbiAgICByZXR1cm4gZmFsc2U7XG4gIC8vIGFuIGlkZW50aWNhbCAncHJvdG90eXBlJyBwcm9wZXJ0eS5cbiAgaWYgKGEucHJvdG90eXBlICE9PSBiLnByb3RvdHlwZSkgcmV0dXJuIGZhbHNlO1xuICAvL35+fkkndmUgbWFuYWdlZCB0byBicmVhayBPYmplY3Qua2V5cyB0aHJvdWdoIHNjcmV3eSBhcmd1bWVudHMgcGFzc2luZy5cbiAgLy8gICBDb252ZXJ0aW5nIHRvIGFycmF5IHNvbHZlcyB0aGUgcHJvYmxlbS5cbiAgaWYgKGlzQXJndW1lbnRzKGEpKSB7XG4gICAgaWYgKCFpc0FyZ3VtZW50cyhiKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBhID0gcFNsaWNlLmNhbGwoYSk7XG4gICAgYiA9IHBTbGljZS5jYWxsKGIpO1xuICAgIHJldHVybiBkZWVwRXF1YWwoYSwgYiwgb3B0cyk7XG4gIH1cbiAgaWYgKGlzQnVmZmVyKGEpKSB7XG4gICAgaWYgKCFpc0J1ZmZlcihiKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gICAgZm9yIChpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHRyeSB7XG4gICAgdmFyIGthID0gb2JqZWN0S2V5cyhhKSxcbiAgICAgICAga2IgPSBvYmplY3RLZXlzKGIpO1xuICB9IGNhdGNoIChlKSB7Ly9oYXBwZW5zIHdoZW4gb25lIGlzIGEgc3RyaW5nIGxpdGVyYWwgYW5kIHRoZSBvdGhlciBpc24ndFxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICAvLyBoYXZpbmcgdGhlIHNhbWUgbnVtYmVyIG9mIG93bmVkIHByb3BlcnRpZXMgKGtleXMgaW5jb3Jwb3JhdGVzXG4gIC8vIGhhc093blByb3BlcnR5KVxuICBpZiAoa2EubGVuZ3RoICE9IGtiLmxlbmd0aClcbiAgICByZXR1cm4gZmFsc2U7XG4gIC8vdGhlIHNhbWUgc2V0IG9mIGtleXMgKGFsdGhvdWdoIG5vdCBuZWNlc3NhcmlseSB0aGUgc2FtZSBvcmRlciksXG4gIGthLnNvcnQoKTtcbiAga2Iuc29ydCgpO1xuICAvL35+fmNoZWFwIGtleSB0ZXN0XG4gIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKGthW2ldICE9IGtiW2ldKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIC8vZXF1aXZhbGVudCB2YWx1ZXMgZm9yIGV2ZXJ5IGNvcnJlc3BvbmRpbmcga2V5LCBhbmRcbiAgLy9+fn5wb3NzaWJseSBleHBlbnNpdmUgZGVlcCB0ZXN0XG4gIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAga2V5ID0ga2FbaV07XG4gICAgaWYgKCFkZWVwRXF1YWwoYVtrZXldLCBiW2tleV0sIG9wdHMpKSByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHR5cGVvZiBhID09PSB0eXBlb2YgYjtcbn1cbn0pO1xuXG5jb25zdCBhc3NlcnRpb25zID0ge1xuICBvayh2YWwsIG1lc3NhZ2UgPSAnc2hvdWxkIGJlIHRydXRoeScpIHtcbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzOiBCb29sZWFuKHZhbCksXG4gICAgICBleHBlY3RlZDogJ3RydXRoeScsXG4gICAgICBhY3R1YWw6IHZhbCxcbiAgICAgIG9wZXJhdG9yOiAnb2snLFxuICAgICAgbWVzc2FnZVxuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIGRlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlID0gJ3Nob3VsZCBiZSBlcXVpdmFsZW50Jykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6IGluZGV4JDEoYWN0dWFsLCBleHBlY3RlZCksXG4gICAgICBhY3R1YWwsXG4gICAgICBleHBlY3RlZCxcbiAgICAgIG1lc3NhZ2UsXG4gICAgICBvcGVyYXRvcjogJ2RlZXBFcXVhbCdcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBlcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlID0gJ3Nob3VsZCBiZSBlcXVhbCcpIHtcbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzOiBhY3R1YWwgPT09IGV4cGVjdGVkLFxuICAgICAgYWN0dWFsLFxuICAgICAgZXhwZWN0ZWQsXG4gICAgICBtZXNzYWdlLFxuICAgICAgb3BlcmF0b3I6ICdlcXVhbCdcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBub3RPayh2YWwsIG1lc3NhZ2UgPSAnc2hvdWxkIG5vdCBiZSB0cnV0aHknKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogIUJvb2xlYW4odmFsKSxcbiAgICAgIGV4cGVjdGVkOiAnZmFsc3knLFxuICAgICAgYWN0dWFsOiB2YWwsXG4gICAgICBvcGVyYXRvcjogJ25vdE9rJyxcbiAgICAgIG1lc3NhZ2VcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBub3REZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSA9ICdzaG91bGQgbm90IGJlIGVxdWl2YWxlbnQnKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogIWluZGV4JDEoYWN0dWFsLCBleHBlY3RlZCksXG4gICAgICBhY3R1YWwsXG4gICAgICBleHBlY3RlZCxcbiAgICAgIG1lc3NhZ2UsXG4gICAgICBvcGVyYXRvcjogJ25vdERlZXBFcXVhbCdcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBub3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlID0gJ3Nob3VsZCBub3QgYmUgZXF1YWwnKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogYWN0dWFsICE9PSBleHBlY3RlZCxcbiAgICAgIGFjdHVhbCxcbiAgICAgIGV4cGVjdGVkLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIG9wZXJhdG9yOiAnbm90RXF1YWwnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgdGhyb3dzKGZ1bmMsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG4gICAgbGV0IGNhdWdodCwgcGFzcywgYWN0dWFsO1xuICAgIGlmICh0eXBlb2YgZXhwZWN0ZWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBbZXhwZWN0ZWQsIG1lc3NhZ2VdID0gW21lc3NhZ2UsIGV4cGVjdGVkXTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGZ1bmMoKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY2F1Z2h0ID0ge2Vycm9yfTtcbiAgICB9XG4gICAgcGFzcyA9IGNhdWdodCAhPT0gdW5kZWZpbmVkO1xuICAgIGFjdHVhbCA9IGNhdWdodCAmJiBjYXVnaHQuZXJyb3I7XG4gICAgaWYgKGV4cGVjdGVkIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICBwYXNzID0gZXhwZWN0ZWQudGVzdChhY3R1YWwpIHx8IGV4cGVjdGVkLnRlc3QoYWN0dWFsICYmIGFjdHVhbC5tZXNzYWdlKTtcbiAgICAgIGV4cGVjdGVkID0gU3RyaW5nKGV4cGVjdGVkKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHBlY3RlZCA9PT0gJ2Z1bmN0aW9uJyAmJiBjYXVnaHQpIHtcbiAgICAgIHBhc3MgPSBhY3R1YWwgaW5zdGFuY2VvZiBleHBlY3RlZDtcbiAgICAgIGFjdHVhbCA9IGFjdHVhbC5jb25zdHJ1Y3RvcjtcbiAgICB9XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzcyxcbiAgICAgIGV4cGVjdGVkLFxuICAgICAgYWN0dWFsLFxuICAgICAgb3BlcmF0b3I6ICd0aHJvd3MnLFxuICAgICAgbWVzc2FnZTogbWVzc2FnZSB8fCAnc2hvdWxkIHRocm93J1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIGRvZXNOb3RUaHJvdyhmdW5jLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuICAgIGxldCBjYXVnaHQ7XG4gICAgaWYgKHR5cGVvZiBleHBlY3RlZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIFtleHBlY3RlZCwgbWVzc2FnZV0gPSBbbWVzc2FnZSwgZXhwZWN0ZWRdO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgZnVuYygpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjYXVnaHQgPSB7ZXJyb3J9O1xuICAgIH1cbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzOiBjYXVnaHQgPT09IHVuZGVmaW5lZCxcbiAgICAgIGV4cGVjdGVkOiAnbm8gdGhyb3duIGVycm9yJyxcbiAgICAgIGFjdHVhbDogY2F1Z2h0ICYmIGNhdWdodC5lcnJvcixcbiAgICAgIG9wZXJhdG9yOiAnZG9lc05vdFRocm93JyxcbiAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UgfHwgJ3Nob3VsZCBub3QgdGhyb3cnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgZmFpbChyZWFzb24gPSAnZmFpbCBjYWxsZWQnKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogZmFsc2UsXG4gICAgICBhY3R1YWw6ICdmYWlsIGNhbGxlZCcsXG4gICAgICBleHBlY3RlZDogJ2ZhaWwgbm90IGNhbGxlZCcsXG4gICAgICBtZXNzYWdlOiByZWFzb24sXG4gICAgICBvcGVyYXRvcjogJ2ZhaWwnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfVxufTtcblxuZnVuY3Rpb24gYXNzZXJ0aW9uICh0ZXN0KSB7XG4gIHJldHVybiBPYmplY3QuY3JlYXRlKGFzc2VydGlvbnMsIHt0ZXN0OiB7dmFsdWU6IHRlc3R9fSk7XG59XG5cbmNvbnN0IFRlc3QgPSB7XG4gIHJ1bjogZnVuY3Rpb24gKCkge1xuICAgIGNvbnN0IGFzc2VydCA9IGFzc2VydGlvbih0aGlzKTtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIHJldHVybiBpbmRleCh0aGlzLmNvcm91dGluZShhc3NlcnQpKVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4ge2Fzc2VydGlvbnM6IHRoaXMuYXNzZXJ0aW9ucywgZXhlY3V0aW9uVGltZTogRGF0ZS5ub3coKSAtIG5vd307XG4gICAgICB9KTtcbiAgfSxcbiAgYWRkQXNzZXJ0aW9uKCl7XG4gICAgY29uc3QgbmV3QXNzZXJ0aW9ucyA9IFsuLi5hcmd1bWVudHNdLm1hcChhID0+IE9iamVjdC5hc3NpZ24oe2Rlc2NyaXB0aW9uOiB0aGlzLmRlc2NyaXB0aW9ufSwgYSkpO1xuICAgIHRoaXMuYXNzZXJ0aW9ucy5wdXNoKC4uLm5ld0Fzc2VydGlvbnMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG59O1xuXG5mdW5jdGlvbiB0ZXN0ICh7ZGVzY3JpcHRpb24sIGNvcm91dGluZSwgb25seSA9IGZhbHNlfSkge1xuICByZXR1cm4gT2JqZWN0LmNyZWF0ZShUZXN0LCB7XG4gICAgZGVzY3JpcHRpb246IHt2YWx1ZTogZGVzY3JpcHRpb259LFxuICAgIGNvcm91dGluZToge3ZhbHVlOiBjb3JvdXRpbmV9LFxuICAgIGFzc2VydGlvbnM6IHt2YWx1ZTogW119LFxuICAgIG9ubHk6IHt2YWx1ZTogb25seX0sXG4gICAgbGVuZ3RoOiB7XG4gICAgICBnZXQoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuYXNzZXJ0aW9ucy5sZW5ndGhcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiB0YXBPdXQgKHtwYXNzLCBtZXNzYWdlLCBpbmRleH0pIHtcbiAgY29uc3Qgc3RhdHVzID0gcGFzcyA9PT0gdHJ1ZSA/ICdvaycgOiAnbm90IG9rJztcbiAgY29uc29sZS5sb2coW3N0YXR1cywgaW5kZXgsIG1lc3NhZ2VdLmpvaW4oJyAnKSk7XG59XG5cbmZ1bmN0aW9uIGNhbkV4aXQgKCkge1xuICByZXR1cm4gdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBwcm9jZXNzLmV4aXQgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIHRhcCAoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAqICgpIHtcbiAgICBsZXQgaW5kZXggPSAxO1xuICAgIGxldCBsYXN0SWQgPSAwO1xuICAgIGxldCBzdWNjZXNzID0gMDtcbiAgICBsZXQgZmFpbHVyZSA9IDA7XG5cbiAgICBjb25zdCBzdGFyVGltZSA9IERhdGUubm93KCk7XG4gICAgY29uc29sZS5sb2coJ1RBUCB2ZXJzaW9uIDEzJyk7XG4gICAgdHJ5IHtcbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2VydGlvbiA9IHlpZWxkO1xuICAgICAgICBpZiAoYXNzZXJ0aW9uLnBhc3MgPT09IHRydWUpIHtcbiAgICAgICAgICBzdWNjZXNzKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZmFpbHVyZSsrO1xuICAgICAgICB9XG4gICAgICAgIGFzc2VydGlvbi5pbmRleCA9IGluZGV4O1xuICAgICAgICBpZiAoYXNzZXJ0aW9uLmlkICE9PSBsYXN0SWQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgIyAke2Fzc2VydGlvbi5kZXNjcmlwdGlvbn0gLSAke2Fzc2VydGlvbi5leGVjdXRpb25UaW1lfW1zYCk7XG4gICAgICAgICAgbGFzdElkID0gYXNzZXJ0aW9uLmlkO1xuICAgICAgICB9XG4gICAgICAgIHRhcE91dChhc3NlcnRpb24pO1xuICAgICAgICBpZiAoYXNzZXJ0aW9uLnBhc3MgIT09IHRydWUpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgICAtLS1cbiAgb3BlcmF0b3I6ICR7YXNzZXJ0aW9uLm9wZXJhdG9yfVxuICBleHBlY3RlZDogJHtKU09OLnN0cmluZ2lmeShhc3NlcnRpb24uZXhwZWN0ZWQpfVxuICBhY3R1YWw6ICR7SlNPTi5zdHJpbmdpZnkoYXNzZXJ0aW9uLmFjdHVhbCl9XG4gIC4uLmApO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5sb2coJ0JhaWwgb3V0ISB1bmhhbmRsZWQgZXhjZXB0aW9uJyk7XG4gICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgIGlmIChjYW5FeGl0KCkpIHtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgICAgfVxuICAgIH1cbiAgICBmaW5hbGx5IHtcbiAgICAgIGNvbnN0IGV4ZWN1dGlvbiA9IERhdGUubm93KCkgLSBzdGFyVGltZTtcbiAgICAgIGlmIChpbmRleCA+IDEpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFxuMS4uJHtpbmRleCAtIDF9XG4jIGR1cmF0aW9uICR7ZXhlY3V0aW9ufW1zXG4jIHN1Y2Nlc3MgJHtzdWNjZXNzfVxuIyBmYWlsdXJlICR7ZmFpbHVyZX1gKTtcbiAgICAgIH1cbiAgICAgIGlmIChmYWlsdXJlICYmIGNhbkV4aXQoKSkge1xuICAgICAgICBwcm9jZXNzLmV4aXQoMSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5jb25zdCBQbGFuID0ge1xuICB0ZXN0KGRlc2NyaXB0aW9uLCBjb3JvdXRpbmUsIG9wdHMgPSB7fSl7XG4gICAgY29uc3QgdGVzdEl0ZW1zID0gKCFjb3JvdXRpbmUgJiYgZGVzY3JpcHRpb24udGVzdHMpID8gWy4uLmRlc2NyaXB0aW9uXSA6IFt7ZGVzY3JpcHRpb24sIGNvcm91dGluZX1dO1xuICAgIHRoaXMudGVzdHMucHVzaCguLi50ZXN0SXRlbXMubWFwKHQ9PnRlc3QoT2JqZWN0LmFzc2lnbih0LCBvcHRzKSkpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICBvbmx5KGRlc2NyaXB0aW9uLCBjb3JvdXRpbmUpe1xuICAgIHJldHVybiB0aGlzLnRlc3QoZGVzY3JpcHRpb24sIGNvcm91dGluZSwge29ubHk6IHRydWV9KTtcbiAgfSxcblxuICBydW4oc2luayA9IHRhcCgpKXtcbiAgICBjb25zdCBzaW5rSXRlcmF0b3IgPSBzaW5rKCk7XG4gICAgc2lua0l0ZXJhdG9yLm5leHQoKTtcbiAgICBjb25zdCBoYXNPbmx5ID0gdGhpcy50ZXN0cy5zb21lKHQ9PnQub25seSk7XG4gICAgY29uc3QgcnVubmFibGUgPSBoYXNPbmx5ID8gdGhpcy50ZXN0cy5maWx0ZXIodD0+dC5vbmx5KSA6IHRoaXMudGVzdHM7XG4gICAgcmV0dXJuIGluZGV4KGZ1bmN0aW9uICogKCkge1xuICAgICAgbGV0IGlkID0gMTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBydW5uYWJsZS5tYXAodD0+dC5ydW4oKSk7XG4gICAgICAgIGZvciAobGV0IHIgb2YgcmVzdWx0cykge1xuICAgICAgICAgIGNvbnN0IHthc3NlcnRpb25zLCBleGVjdXRpb25UaW1lfSA9IHlpZWxkIHI7XG4gICAgICAgICAgZm9yIChsZXQgYXNzZXJ0IG9mIGFzc2VydGlvbnMpIHtcbiAgICAgICAgICAgIHNpbmtJdGVyYXRvci5uZXh0KE9iamVjdC5hc3NpZ24oYXNzZXJ0LCB7aWQsIGV4ZWN1dGlvblRpbWV9KSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlkKys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgIHNpbmtJdGVyYXRvci50aHJvdyhlKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHNpbmtJdGVyYXRvci5yZXR1cm4oKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpXG4gIH0sXG5cbiAgKiBbU3ltYm9sLml0ZXJhdG9yXSgpe1xuICAgIGZvciAobGV0IHQgb2YgdGhpcy50ZXN0cykge1xuICAgICAgeWllbGQgdDtcbiAgICB9XG4gIH1cbn07XG5cbmZ1bmN0aW9uIHBsYW4gKCkge1xuICByZXR1cm4gT2JqZWN0LmNyZWF0ZShQbGFuLCB7XG4gICAgdGVzdHM6IHt2YWx1ZTogW119LFxuICAgIGxlbmd0aDoge1xuICAgICAgZ2V0KCl7XG4gICAgICAgIHJldHVybiB0aGlzLnRlc3RzLmxlbmd0aFxuICAgICAgfVxuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHBsYW47XG4iLCJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJpbXBvcnQge2N1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5leHBvcnQgZnVuY3Rpb24qIGdpdmVNZU4gKG4pIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyBpKyspIHtcbiAgICB5aWVsZCBpO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBkb05UaW1lcyA9IGN1cnJ5KChmbiwgY291bnQgPSAxKSA9PiB7XG4gIGNvbnN0IG4gPSBjb3VudCB8fCAxO1xuICBbLi4uZ2l2ZU1lTihuKV0uZm9yRWFjaCgoKSA9PiBmbigpKTtcbn0sIDIpO1xuIiwiaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5pbXBvcnQge2dpdmVNZU4sIGRvTlRpbWVzfSBmcm9tICcuLi9saWIvaGVscGVyJztcblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KCdnaXZlIG1lIG4nLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgbiA9IFsuLi5naXZlTWVOKDUpXTtcbiAgICB0LmRlZXBFcXVhbChuLCBbMCwgMSwgMiwgMywgNCxdKTtcbiAgfSlcbiAgLnRlc3QoJ2dpdmUgbWUgbm9uZScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBuID0gWy4uLmdpdmVNZU4oKV07XG4gICAgdC5kZWVwRXF1YWwobiwgW10pO1xuICB9KVxuICAudGVzdCgnZG8gbiB0aW1lcycsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBsZXQgY291bnRlciA9IDA7XG4gICAgZG9OVGltZXMoKCkgPT4gY291bnRlcisrLCA0KTtcbiAgICB0LmVxdWFsKGNvdW50ZXIsIDQpO1xuICB9KVxuICAudGVzdCgnZG8gbiB0aW1lcyAoY3VycmllZCknLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgbGV0IGNvdW50ZXIgPSAwO1xuICAgIGRvTlRpbWVzKCgpID0+IGNvdW50ZXIrKykoNCk7XG4gICAgdC5lcXVhbChjb3VudGVyLCA0KTtcbiAgfSlcbiAgLnRlc3QoJ2RvIG9uY2UgYnkgZGVmYXVsdCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBsZXQgY291bnRlciA9IDA7XG4gICAgZG9OVGltZXMoKCkgPT4gY291bnRlcisrKSgpO1xuICAgIHQuZXF1YWwoY291bnRlciwgMSk7XG4gIH0pOyIsImltcG9ydCB7ZG9OVGltZXN9IGZyb20gJy4vaGVscGVyJztcblxuY29uc3QgZXZlbnR1YWxseURvID0gKGZuLCB2YWwpID0+IHtcbiAgaWYgKHZhbCkge1xuICAgIGZuKHZhbCk7XG4gIH1cbn07XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7Y2FwYWNpdHkgPSAxMDAwfSA9IHt9KSB7XG4gIGNvbnN0IGFycmF5QnVmZmVyID0gW107XG4gIGNvbnN0IGluc3RhbmNlID0ge1xuICAgIHBvcDogZG9OVGltZXMoKCkgPT4ge1xuICAgICAgZXZlbnR1YWxseURvKChpdGVtKSA9PiBpdGVtLnJvdy5jbGVhbigpLCBhcnJheUJ1ZmZlci5wb3AoKSk7XG4gICAgfSksXG4gICAgc2hpZnQ6IGRvTlRpbWVzKCgpID0+IHtcbiAgICAgIGV2ZW50dWFsbHlEbygoaXRlbSkgPT4gaXRlbS5yb3cuY2xlYW4oKSwgYXJyYXlCdWZmZXIuc2hpZnQoKSk7XG4gICAgfSksXG4gICAgdW5zaGlmdCgpe1xuICAgICAgYXJyYXlCdWZmZXIudW5zaGlmdCguLi5hcmd1bWVudHMpO1xuICAgICAgZXZlbnR1YWxseURvKGluc3RhbmNlLnBvcCwgTWF0aC5tYXgoYXJyYXlCdWZmZXIubGVuZ3RoIC0gY2FwYWNpdHksIDApKTtcbiAgICB9LFxuICAgIHB1c2goKXtcbiAgICAgIGFycmF5QnVmZmVyLnB1c2goLi4uYXJndW1lbnRzKTtcbiAgICAgIGV2ZW50dWFsbHlEbyhpbnN0YW5jZS5zaGlmdCwgTWF0aC5tYXgoYXJyYXlCdWZmZXIubGVuZ3RoIC0gY2FwYWNpdHksIDApKTtcbiAgICB9LFxuICAgIGdldChpbmRleCl7XG4gICAgICByZXR1cm4gYXJyYXlCdWZmZXIuZmluZChpdGVtID0+IGl0ZW0uaW5kZXggPT09IGluZGV4KTtcbiAgICB9LFxuICAgIHNsaWNlOiBmdW5jdGlvbiAqIChzdGFydCwgbikge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IGluc3RhbmNlLmdldChzdGFydCArIGkpO1xuICAgICAgICBpZiAoaXRlbSkge1xuICAgICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGhlYWQoKXtcbiAgICAgIHJldHVybiBhcnJheUJ1ZmZlclswXTtcbiAgICB9LFxuICAgIHRhaWwoKXtcbiAgICAgIHJldHVybiBhcnJheUJ1ZmZlclthcnJheUJ1ZmZlci5sZW5ndGggLSAxXTtcbiAgICB9LFxuICAgIHBvc2l0aW9uKGluZGV4KXtcbiAgICAgIHJldHVybiBhcnJheUJ1ZmZlci5pbmRleE9mKGluc3RhbmNlLmdldChpbmRleCkpIC8gYXJyYXlCdWZmZXIubGVuZ3RoO1xuICAgIH1cbiAgfTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoaW5zdGFuY2UsICdsZW5ndGgnLCB7XG4gICAgZ2V0OiAoKSA9PiBhcnJheUJ1ZmZlci5sZW5ndGhcbiAgfSk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufSIsImltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuaW1wb3J0IGJ1ZmZlciBmcm9tICcuLi9saWIvaXRlbXNCdWZmZXInO1xuXG5jb25zdCBpdGVtRmFjdG9yeSA9IChpdGVtKSA9PiB7XG5cbiAgbGV0IGNsZWFuZWQgPSBmYWxzZTtcblxuICBjb25zdCByb3cgPSB7XG4gICAgY2xlYW4oKXtcbiAgICAgIGNsZWFuZWQgPSB0cnVlXG4gICAgfVxuICB9O1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyb3csICdjbGVhbmVkJywge1xuICAgIGdldCgpe1xuICAgICAgcmV0dXJuIGNsZWFuZWQ7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4ge1xuICAgIHJvdyxcbiAgICBpZDppdGVtLmlkXG4gIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCB6b3JhKClcbiAgLnRlc3QoJ2NsZWFuIGl0ZW0gd2hlbiBwb3AnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgYiA9IGJ1ZmZlcigpO1xuICAgIGNvbnN0IGl0ZW0gPSBpdGVtRmFjdG9yeSh7aWQ6IDY2Nn0pO1xuICAgIGIucHVzaChpdGVtKTtcbiAgICB0LmVxdWFsKGIubGVuZ3RoLCAxKTtcbiAgICB0LmVxdWFsKGl0ZW0ucm93LmNsZWFuZWQsIGZhbHNlKTtcbiAgICBiLnBvcCgpO1xuICAgIHQuZXF1YWwoYi5sZW5ndGgsIDApO1xuICAgIHQuZXF1YWwoaXRlbS5yb3cuY2xlYW5lZCwgdHJ1ZSk7XG4gIH0pXG4gIC50ZXN0KCdjbGVhbiBpdGVtIHdoZW4gc2hpZnQnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgYiA9IGJ1ZmZlcigpO1xuICAgIGNvbnN0IGl0ZW0gPSBpdGVtRmFjdG9yeSh7aWQ6IDY2Nn0pO1xuICAgIGIucHVzaChpdGVtKTtcbiAgICB0LmVxdWFsKGIubGVuZ3RoLCAxKTtcbiAgICB0LmVxdWFsKGl0ZW0ucm93LmNsZWFuZWQsIGZhbHNlKTtcbiAgICBiLnNoaWZ0KCk7XG4gICAgdC5lcXVhbChiLmxlbmd0aCwgMCk7XG4gICAgdC5lcXVhbChpdGVtLnJvdy5jbGVhbmVkLCB0cnVlKTtcbiAgfSlcbiAgLnRlc3QoJ3B1c2ggbXVsdGlwbGUgaXRlbXMnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgYiA9IGJ1ZmZlcigpO1xuICAgIGNvbnN0IGl0ZW1zID0gWzIzMywgNDU1XS5tYXAoaWQgPT4gaXRlbUZhY3Rvcnkoe2lkfSkpO1xuICAgIGIucHVzaCguLi5pdGVtcyk7XG4gICAgdC5lcXVhbChiLmxlbmd0aCwgMik7XG4gICAgaXRlbXMuZm9yRWFjaCgoaXRlbSwgaW5kZXgpID0+IHtcbiAgICAgIHQuZGVlcEVxdWFsKGIuZ2V0KGluZGV4KSwgaXRlbXNbaW5kZXhdKTtcbiAgICB9KTtcbiAgfSlcbiAgLnRlc3QoJ3Vuc2hpZnQgbXVsdGlwbGUgaXRlbXMnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgYiA9IGJ1ZmZlcigpO1xuICAgIGNvbnN0IGl0ZW1zID0gWzIzMywgNDU1XS5tYXAoaWQgPT4gaXRlbUZhY3Rvcnkoe2lkfSkpO1xuICAgIGIudW5zaGlmdCguLi5pdGVtcyk7XG4gICAgdC5lcXVhbChiLmxlbmd0aCwgMik7XG4gICAgaXRlbXMuZm9yRWFjaCgoaXRlbSwgaW5kZXgpID0+IHtcbiAgICAgIHQuZGVlcEVxdWFsKGIuZ2V0KGluZGV4KSwgaXRlbXNbaW5kZXhdKTtcbiAgICB9KTtcbiAgfSlcbiAgLnRlc3QoJ3NoaWZ0IGV4dHJhIGl0ZW0gd2hlbiBwdXNoIGV4Y2VlZCBjYXBhY2l0eScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBiID0gYnVmZmVyKHtjYXBhY2l0eTogMX0pO1xuICAgIGNvbnN0IGl0ZW0xID0gaXRlbUZhY3Rvcnkoe2lkOiAxfSk7XG4gICAgY29uc3QgaXRlbTIgPSBpdGVtRmFjdG9yeSh7aWQ6IDJ9KTtcbiAgICBiLnB1c2goaXRlbTEpO1xuICAgIHQuZXF1YWwoYi5sZW5ndGgsIDEpO1xuICAgIGIucHVzaChpdGVtMik7XG4gICAgdC5lcXVhbChiLmxlbmd0aCwgMSk7XG4gICAgdC5lcXVhbChiLmdldCgwKSwgaXRlbTIpO1xuICB9KVxuICAudGVzdCgncG9wIGV4dHJhIGl0ZW0gd2hlbiB1bnNoaWZ0IGV4Y2VlZCBjYXBhY2l0eScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBiID0gYnVmZmVyKHtjYXBhY2l0eTogMX0pO1xuICAgIGNvbnN0IGl0ZW0xID0gaXRlbUZhY3Rvcnkoe2lkOiAxfSk7XG4gICAgY29uc3QgaXRlbTIgPSBpdGVtRmFjdG9yeSh7aWQ6IDJ9KTtcbiAgICBiLnVuc2hpZnQoaXRlbTEpO1xuICAgIHQuZXF1YWwoYi5sZW5ndGgsIDEpO1xuICAgIGIudW5zaGlmdChpdGVtMik7XG4gICAgdC5lcXVhbChiLmxlbmd0aCwgMSk7XG4gICAgdC5lcXVhbChiLmdldCgwKSwgaXRlbTIpO1xuICB9KSIsImltcG9ydCB7Z2l2ZU1lTn0gZnJvbSAnLi9oZWxwZXInO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3RhYmxlfSkge1xuICByZXR1cm4ge1xuICAgIHB1bGwob2Zmc2V0LCBudW1iZXIpe1xuICAgICAgY29uc3QgdGFibGVTdGF0ZSA9IHRhYmxlLmdldFRhYmxlU3RhdGUoKTtcbiAgICAgIGNvbnN0IHtzbGljZTp7c2l6ZTpwYWdlU2l6ZX19ID0gdGFibGVTdGF0ZTtcbiAgICAgIGNvbnN0IHN0YXJ0UGFnZSA9IE1hdGguZmxvb3Iob2Zmc2V0IC8gcGFnZVNpemUpO1xuICAgICAgY29uc3QgdHJpbUJlZm9yZSA9IG9mZnNldCAlIHBhZ2VTaXplO1xuICAgICAgY29uc3QgbGFzdFBhZ2UgPSBNYXRoLmNlaWwoKG9mZnNldCArIG51bWJlcikgLyBwYWdlU2l6ZSk7XG4gICAgICBjb25zdCBwYWdlQ29uZkxpc3QgPSBbLi4uZ2l2ZU1lTihsYXN0UGFnZSAtIHN0YXJ0UGFnZSldLm1hcChvZmYgPT4gKHtcbiAgICAgICAgcGFnZTogc3RhcnRQYWdlICsgb2ZmICsgMSxcbiAgICAgICAgc2l6ZTogcGFnZVNpemVcbiAgICAgIH0pKTtcbiAgICAgIHJldHVybiBQcm9taXNlLmFsbChwYWdlQ29uZkxpc3QubWFwKHNsaWNlID0+IHtcbiAgICAgICAgcmV0dXJuIHRhYmxlLmV2YWwoT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZSwge3NsaWNlfSkpO1xuICAgICAgfSwgW10pKVxuICAgICAgICAudGhlbihwYWdlcyA9PiB7XG4gICAgICAgICAgcmV0dXJuIHBhZ2VzLnJlZHVjZSgoYWNjLCBjdXJyKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYWNjLmNvbmNhdChjdXJyKTtcbiAgICAgICAgICB9LCBbXSlcbiAgICAgICAgICAgIC5maWx0ZXIoKGl0ZW0sIGluZGV4KSA9PiBpbmRleCA+PSB0cmltQmVmb3JlKVxuICAgICAgICAgICAgLnNsaWNlKDAsIG51bWJlcik7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgfTtcbn0iLCJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwb2ludGVyIChwYXRoKSB7XG5cbiAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XG5cbiAgZnVuY3Rpb24gcGFydGlhbCAob2JqID0ge30sIHBhcnRzID0gW10pIHtcbiAgICBjb25zdCBwID0gcGFydHMuc2hpZnQoKTtcbiAgICBjb25zdCBjdXJyZW50ID0gb2JqW3BdO1xuICAgIHJldHVybiAoY3VycmVudCA9PT0gdW5kZWZpbmVkIHx8IHBhcnRzLmxlbmd0aCA9PT0gMCkgP1xuICAgICAgY3VycmVudCA6IHBhcnRpYWwoY3VycmVudCwgcGFydHMpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0ICh0YXJnZXQsIG5ld1RyZWUpIHtcbiAgICBsZXQgY3VycmVudCA9IHRhcmdldDtcbiAgICBjb25zdCBbbGVhZiwgLi4uaW50ZXJtZWRpYXRlXSA9IHBhcnRzLnJldmVyc2UoKTtcbiAgICBmb3IgKGxldCBrZXkgb2YgaW50ZXJtZWRpYXRlLnJldmVyc2UoKSkge1xuICAgICAgaWYgKGN1cnJlbnRba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGN1cnJlbnRba2V5XSA9IHt9O1xuICAgICAgICBjdXJyZW50ID0gY3VycmVudFtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBjdXJyZW50W2xlYWZdID0gT2JqZWN0LmFzc2lnbihjdXJyZW50W2xlYWZdIHx8IHt9LCBuZXdUcmVlKTtcbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBnZXQodGFyZ2V0KXtcbiAgICAgIHJldHVybiBwYXJ0aWFsKHRhcmdldCwgWy4uLnBhcnRzXSlcbiAgICB9LFxuICAgIHNldFxuICB9XG59O1xuIiwiaW1wb3J0IHtzd2FwfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuXG5mdW5jdGlvbiBzb3J0QnlQcm9wZXJ0eSAocHJvcCkge1xuICBjb25zdCBwcm9wR2V0dGVyID0gcG9pbnRlcihwcm9wKS5nZXQ7XG4gIHJldHVybiAoYSwgYikgPT4ge1xuICAgIGNvbnN0IGFWYWwgPSBwcm9wR2V0dGVyKGEpO1xuICAgIGNvbnN0IGJWYWwgPSBwcm9wR2V0dGVyKGIpO1xuXG4gICAgaWYgKGFWYWwgPT09IGJWYWwpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGlmIChiVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICBpZiAoYVZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gYVZhbCA8IGJWYWwgPyAtMSA6IDE7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc29ydEZhY3RvcnkgKHtwb2ludGVyLCBkaXJlY3Rpb259ID0ge30pIHtcbiAgaWYgKCFwb2ludGVyIHx8IGRpcmVjdGlvbiA9PT0gJ25vbmUnKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IFsuLi5hcnJheV07XG4gIH1cblxuICBjb25zdCBvcmRlckZ1bmMgPSBzb3J0QnlQcm9wZXJ0eShwb2ludGVyKTtcbiAgY29uc3QgY29tcGFyZUZ1bmMgPSBkaXJlY3Rpb24gPT09ICdkZXNjJyA/IHN3YXAob3JkZXJGdW5jKSA6IG9yZGVyRnVuYztcblxuICByZXR1cm4gKGFycmF5KSA9PiBbLi4uYXJyYXldLnNvcnQoY29tcGFyZUZ1bmMpO1xufSIsImltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmZ1bmN0aW9uIHR5cGVFeHByZXNzaW9uICh0eXBlKSB7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIEJvb2xlYW47XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBOdW1iZXI7XG4gICAgY2FzZSAnZGF0ZSc6XG4gICAgICByZXR1cm4gKHZhbCkgPT4gbmV3IERhdGUodmFsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGNvbXBvc2UoU3RyaW5nLCAodmFsKSA9PiB2YWwudG9Mb3dlckNhc2UoKSk7XG4gIH1cbn1cblxuY29uc3Qgb3BlcmF0b3JzID0ge1xuICBpbmNsdWRlcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQuaW5jbHVkZXModmFsdWUpO1xuICB9LFxuICBpcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGlzTm90KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiAhT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGx0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8IHZhbHVlO1xuICB9LFxuICBndCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPiB2YWx1ZTtcbiAgfSxcbiAgbHRlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8PSB2YWx1ZTtcbiAgfSxcbiAgZ3RlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+PSB2YWx1ZTtcbiAgfSxcbiAgZXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSA9PSBpbnB1dDtcbiAgfSxcbiAgbm90RXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSAhPSBpbnB1dDtcbiAgfVxufTtcblxuY29uc3QgZXZlcnkgPSBmbnMgPT4gKC4uLmFyZ3MpID0+IGZucy5ldmVyeShmbiA9PiBmbiguLi5hcmdzKSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVkaWNhdGUgKHt2YWx1ZSA9ICcnLCBvcGVyYXRvciA9ICdpbmNsdWRlcycsIHR5cGUgPSAnc3RyaW5nJ30pIHtcbiAgY29uc3QgdHlwZUl0ID0gdHlwZUV4cHJlc3Npb24odHlwZSk7XG4gIGNvbnN0IG9wZXJhdGVPblR5cGVkID0gY29tcG9zZSh0eXBlSXQsIG9wZXJhdG9yc1tvcGVyYXRvcl0pO1xuICBjb25zdCBwcmVkaWNhdGVGdW5jID0gb3BlcmF0ZU9uVHlwZWQodmFsdWUpO1xuICByZXR1cm4gY29tcG9zZSh0eXBlSXQsIHByZWRpY2F0ZUZ1bmMpO1xufVxuXG4vL2F2b2lkIHVzZWxlc3MgZmlsdGVyIGxvb2t1cCAoaW1wcm92ZSBwZXJmKVxuZnVuY3Rpb24gbm9ybWFsaXplQ2xhdXNlcyAoY29uZikge1xuICBjb25zdCBvdXRwdXQgPSB7fTtcbiAgY29uc3QgdmFsaWRQYXRoID0gT2JqZWN0LmtleXMoY29uZikuZmlsdGVyKHBhdGggPT4gQXJyYXkuaXNBcnJheShjb25mW3BhdGhdKSk7XG4gIHZhbGlkUGF0aC5mb3JFYWNoKHBhdGggPT4ge1xuICAgIGNvbnN0IHZhbGlkQ2xhdXNlcyA9IGNvbmZbcGF0aF0uZmlsdGVyKGMgPT4gYy52YWx1ZSAhPT0gJycpO1xuICAgIGlmICh2YWxpZENsYXVzZXMubGVuZ3RoKSB7XG4gICAgICBvdXRwdXRbcGF0aF0gPSB2YWxpZENsYXVzZXM7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmlsdGVyIChmaWx0ZXIpIHtcbiAgY29uc3Qgbm9ybWFsaXplZENsYXVzZXMgPSBub3JtYWxpemVDbGF1c2VzKGZpbHRlcik7XG4gIGNvbnN0IGZ1bmNMaXN0ID0gT2JqZWN0LmtleXMobm9ybWFsaXplZENsYXVzZXMpLm1hcChwYXRoID0+IHtcbiAgICBjb25zdCBnZXR0ZXIgPSBwb2ludGVyKHBhdGgpLmdldDtcbiAgICBjb25zdCBjbGF1c2VzID0gbm9ybWFsaXplZENsYXVzZXNbcGF0aF0ubWFwKHByZWRpY2F0ZSk7XG4gICAgcmV0dXJuIGNvbXBvc2UoZ2V0dGVyLCBldmVyeShjbGF1c2VzKSk7XG4gIH0pO1xuICBjb25zdCBmaWx0ZXJQcmVkaWNhdGUgPSBldmVyeShmdW5jTGlzdCk7XG5cbiAgcmV0dXJuIChhcnJheSkgPT4gYXJyYXkuZmlsdGVyKGZpbHRlclByZWRpY2F0ZSk7XG59IiwiaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHNlYXJjaENvbmYgPSB7fSkge1xuICBjb25zdCB7dmFsdWUsIHNjb3BlID0gW119ID0gc2VhcmNoQ29uZjtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlcnMgPSBzY29wZS5tYXAoZmllbGQgPT4gcG9pbnRlcihmaWVsZCkuZ2V0KTtcbiAgaWYgKCFzY29wZS5sZW5ndGggfHwgIXZhbHVlKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBhcnJheSA9PiBhcnJheS5maWx0ZXIoaXRlbSA9PiBzZWFyY2hQb2ludGVycy5zb21lKHAgPT4gU3RyaW5nKHAoaXRlbSkpLmluY2x1ZGVzKFN0cmluZyh2YWx1ZSkpKSlcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNsaWNlRmFjdG9yeSAoe3BhZ2UgPSAxLCBzaXplfSA9IHt9KSB7XG4gIHJldHVybiBmdW5jdGlvbiBzbGljZUZ1bmN0aW9uIChhcnJheSA9IFtdKSB7XG4gICAgY29uc3QgYWN0dWFsU2l6ZSA9IHNpemUgfHwgYXJyYXkubGVuZ3RoO1xuICAgIGNvbnN0IG9mZnNldCA9IChwYWdlIC0gMSkgKiBhY3R1YWxTaXplO1xuICAgIHJldHVybiBhcnJheS5zbGljZShvZmZzZXQsIG9mZnNldCArIGFjdHVhbFNpemUpO1xuICB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGVtaXR0ZXIgKCkge1xuXG4gIGNvbnN0IGxpc3RlbmVyc0xpc3RzID0ge307XG5cbiAgcmV0dXJuIHtcbiAgICBvbihldmVudCwgLi4ubGlzdGVuZXJzKXtcbiAgICAgIGxpc3RlbmVyc0xpc3RzW2V2ZW50XSA9IChsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW10pLmNvbmNhdChsaXN0ZW5lcnMpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBkaXNwYXRjaChldmVudCwgLi4uYXJncyl7XG4gICAgICBjb25zdCBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW107XG4gICAgICBmb3IgKGxldCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgbGlzdGVuZXIoLi4uYXJncyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIG9mZihldmVudCwgLi4ubGlzdGVuZXJzKXtcbiAgICAgIGlmICghZXZlbnQpIHtcbiAgICAgICAgT2JqZWN0LmtleXMobGlzdGVuZXJzTGlzdHMpLmZvckVhY2goZXYgPT4gdGhpcy5vZmYoZXYpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGxpc3QgPSBsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW107XG4gICAgICAgIGxpc3RlbmVyc0xpc3RzW2V2ZW50XSA9IGxpc3RlbmVycy5sZW5ndGggPyBsaXN0LmZpbHRlcihsaXN0ZW5lciA9PiAhbGlzdGVuZXJzLmluY2x1ZGVzKGxpc3RlbmVyKSkgOiBbXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJveHlMaXN0ZW5lciAoZXZlbnRNYXApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh7ZW1pdHRlcn0pIHtcblxuICAgIGNvbnN0IHByb3h5ID0ge307XG4gICAgbGV0IGV2ZW50TGlzdGVuZXJzID0ge307XG5cbiAgICBmb3IgKGxldCBldiBvZiBPYmplY3Qua2V5cyhldmVudE1hcCkpIHtcbiAgICAgIGNvbnN0IG1ldGhvZCA9IGV2ZW50TWFwW2V2XTtcbiAgICAgIGV2ZW50TGlzdGVuZXJzW2V2XSA9IFtdO1xuICAgICAgcHJveHlbbWV0aG9kXSA9IGZ1bmN0aW9uICguLi5saXN0ZW5lcnMpIHtcbiAgICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gZXZlbnRMaXN0ZW5lcnNbZXZdLmNvbmNhdChsaXN0ZW5lcnMpO1xuICAgICAgICBlbWl0dGVyLm9uKGV2LCAuLi5saXN0ZW5lcnMpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocHJveHksIHtcbiAgICAgIG9mZihldil7XG4gICAgICAgIGlmICghZXYpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhldmVudExpc3RlbmVycykuZm9yRWFjaChldmVudE5hbWUgPT4gdGhpcy5vZmYoZXZlbnROYW1lKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXZlbnRMaXN0ZW5lcnNbZXZdKSB7XG4gICAgICAgICAgZW1pdHRlci5vZmYoZXYsIC4uLmV2ZW50TGlzdGVuZXJzW2V2XSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSIsImV4cG9ydCBjb25zdCBUT0dHTEVfU09SVCA9ICdUT0dHTEVfU09SVCc7XG5leHBvcnQgY29uc3QgRElTUExBWV9DSEFOR0VEID0gJ0RJU1BMQVlfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgUEFHRV9DSEFOR0VEID0gJ0NIQU5HRV9QQUdFJztcbmV4cG9ydCBjb25zdCBFWEVDX0NIQU5HRUQgPSAnRVhFQ19TVEFSVEVEJztcbmV4cG9ydCBjb25zdCBGSUxURVJfQ0hBTkdFRCA9ICdGSUxURVJfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgU1VNTUFSWV9DSEFOR0VEID0gJ1NVTU1BUllfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgU0VBUkNIX0NIQU5HRUQgPSAnU0VBUkNIX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IEVYRUNfRVJST1IgPSAnRVhFQ19FUlJPUic7IiwiaW1wb3J0IHNsaWNlIGZyb20gJy4uL3NsaWNlJztcbmltcG9ydCB7Y3VycnksIHRhcCwgY29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5pbXBvcnQge2VtaXR0ZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5pbXBvcnQgc2xpY2VGYWN0b3J5IGZyb20gJy4uL3NsaWNlJztcbmltcG9ydCB7XG4gIFNVTU1BUllfQ0hBTkdFRCxcbiAgVE9HR0xFX1NPUlQsXG4gIERJU1BMQVlfQ0hBTkdFRCxcbiAgUEFHRV9DSEFOR0VELFxuICBFWEVDX0NIQU5HRUQsXG4gIEZJTFRFUl9DSEFOR0VELFxuICBTRUFSQ0hfQ0hBTkdFRCxcbiAgRVhFQ19FUlJPUlxufSBmcm9tICcuLi9ldmVudHMnO1xuXG5mdW5jdGlvbiBjdXJyaWVkUG9pbnRlciAocGF0aCkge1xuICBjb25zdCB7Z2V0LCBzZXR9ID0gcG9pbnRlcihwYXRoKTtcbiAgcmV0dXJuIHtnZXQsIHNldDogY3Vycnkoc2V0KX07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7XG4gIHNvcnRGYWN0b3J5LFxuICB0YWJsZVN0YXRlLFxuICBkYXRhLFxuICBmaWx0ZXJGYWN0b3J5LFxuICBzZWFyY2hGYWN0b3J5XG59KSB7XG4gIGNvbnN0IHRhYmxlID0gZW1pdHRlcigpO1xuICBjb25zdCBzb3J0UG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzb3J0Jyk7XG4gIGNvbnN0IHNsaWNlUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzbGljZScpO1xuICBjb25zdCBmaWx0ZXJQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ2ZpbHRlcicpO1xuICBjb25zdCBzZWFyY2hQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NlYXJjaCcpO1xuXG4gIGNvbnN0IHNhZmVBc3NpZ24gPSBjdXJyeSgoYmFzZSwgZXh0ZW5zaW9uKSA9PiBPYmplY3QuYXNzaWduKHt9LCBiYXNlLCBleHRlbnNpb24pKTtcbiAgY29uc3QgZGlzcGF0Y2ggPSBjdXJyeSh0YWJsZS5kaXNwYXRjaC5iaW5kKHRhYmxlKSwgMik7XG5cbiAgY29uc3QgY3JlYXRlU3VtbWFyeSA9IChmaWx0ZXJlZCkgPT4ge1xuICAgIGRpc3BhdGNoKFNVTU1BUllfQ0hBTkdFRCwge1xuICAgICAgcGFnZTogdGFibGVTdGF0ZS5zbGljZS5wYWdlLFxuICAgICAgc2l6ZTogdGFibGVTdGF0ZS5zbGljZS5zaXplLFxuICAgICAgZmlsdGVyZWRDb3VudDogZmlsdGVyZWQubGVuZ3RoXG4gICAgfSk7XG4gIH07XG5cbiAgY29uc3QgZXhlYyA9ICh7cHJvY2Vzc2luZ0RlbGF5ID0gMjB9ID0ge30pID0+IHtcbiAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiB0cnVlfSk7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBmaWx0ZXJGdW5jID0gZmlsdGVyRmFjdG9yeShmaWx0ZXJQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCB0YXAoY3JlYXRlU3VtbWFyeSksIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICBjb25zdCBkaXNwbGF5ZWQgPSBleGVjRnVuYyhkYXRhKTtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRElTUExBWV9DSEFOR0VELCBkaXNwbGF5ZWQubWFwKGQgPT4ge1xuICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9O1xuICAgICAgICB9KSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfRVJST1IsIGUpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogZmFsc2V9KTtcbiAgICAgIH1cbiAgICB9LCBwcm9jZXNzaW5nRGVsYXkpO1xuICB9O1xuXG4gIGNvbnN0IHVwZGF0ZVRhYmxlU3RhdGUgPSBjdXJyeSgocHRlciwgZXYsIG5ld1BhcnRpYWxTdGF0ZSkgPT4gY29tcG9zZShcbiAgICBzYWZlQXNzaWduKHB0ZXIuZ2V0KHRhYmxlU3RhdGUpKSxcbiAgICB0YXAoZGlzcGF0Y2goZXYpKSxcbiAgICBwdGVyLnNldCh0YWJsZVN0YXRlKVxuICApKG5ld1BhcnRpYWxTdGF0ZSkpO1xuXG4gIGNvbnN0IHJlc2V0VG9GaXJzdFBhZ2UgPSAoKSA9PiB1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VELCB7cGFnZTogMX0pO1xuXG4gIGNvbnN0IHRhYmxlT3BlcmF0aW9uID0gKHB0ZXIsIGV2KSA9PiBjb21wb3NlKFxuICAgIHVwZGF0ZVRhYmxlU3RhdGUocHRlciwgZXYpLFxuICAgIHJlc2V0VG9GaXJzdFBhZ2UsXG4gICAgKCkgPT4gdGFibGUuZXhlYygpIC8vIHdlIHdyYXAgd2l0aGluIGEgZnVuY3Rpb24gc28gdGFibGUuZXhlYyBjYW4gYmUgb3ZlcndyaXR0ZW4gKHdoZW4gdXNpbmcgd2l0aCBhIHNlcnZlciBmb3IgZXhhbXBsZSlcbiAgKTtcblxuICBjb25zdCBhcGkgPSB7XG4gICAgc29ydDogdGFibGVPcGVyYXRpb24oc29ydFBvaW50ZXIsIFRPR0dMRV9TT1JUKSxcbiAgICBmaWx0ZXI6IHRhYmxlT3BlcmF0aW9uKGZpbHRlclBvaW50ZXIsIEZJTFRFUl9DSEFOR0VEKSxcbiAgICBzZWFyY2g6IHRhYmxlT3BlcmF0aW9uKHNlYXJjaFBvaW50ZXIsIFNFQVJDSF9DSEFOR0VEKSxcbiAgICBzbGljZTogY29tcG9zZSh1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VEKSwgKCkgPT4gdGFibGUuZXhlYygpKSxcbiAgICBleGVjLFxuICAgIGV2YWwoc3RhdGUgPSB0YWJsZVN0YXRlKXtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgICAgcmV0dXJuIGV4ZWNGdW5jKGRhdGEpLm1hcChkID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgb25EaXNwbGF5Q2hhbmdlKGZuKXtcbiAgICAgIHRhYmxlLm9uKERJU1BMQVlfQ0hBTkdFRCwgZm4pO1xuICAgIH0sXG4gICAgZ2V0VGFibGVTdGF0ZSgpe1xuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUpXG4gICAgfVxuICB9O1xuXG4gIHJldHVybiBPYmplY3QuYXNzaWduKHRhYmxlLCBhcGkpO1xufSIsImltcG9ydCBzb3J0IGZyb20gJ3NtYXJ0LXRhYmxlLXNvcnQnO1xuaW1wb3J0IGZpbHRlciBmcm9tICdzbWFydC10YWJsZS1maWx0ZXInO1xuaW1wb3J0IHNlYXJjaCBmcm9tICdzbWFydC10YWJsZS1zZWFyY2gnO1xuaW1wb3J0IHRhYmxlIGZyb20gJy4vZGlyZWN0aXZlcy90YWJsZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7XG4gIHNvcnRGYWN0b3J5ID0gc29ydCxcbiAgZmlsdGVyRmFjdG9yeSA9IGZpbHRlcixcbiAgc2VhcmNoRmFjdG9yeSA9IHNlYXJjaCxcbiAgdGFibGVTdGF0ZSA9IHtzb3J0OiB7fSwgc2xpY2U6IHtwYWdlOiAxfSwgZmlsdGVyOiB7fSwgc2VhcmNoOiB7fX0sXG4gIGRhdGEgPSBbXVxufSwgLi4udGFibGVEaXJlY3RpdmVzKSB7XG5cbiAgY29uc3QgY29yZVRhYmxlID0gdGFibGUoe3NvcnRGYWN0b3J5LCBmaWx0ZXJGYWN0b3J5LCB0YWJsZVN0YXRlLCBkYXRhLCBzZWFyY2hGYWN0b3J5fSk7XG5cbiAgcmV0dXJuIHRhYmxlRGlyZWN0aXZlcy5yZWR1Y2UoKGFjY3VtdWxhdG9yLCBuZXdkaXIpID0+IHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihhY2N1bXVsYXRvciwgbmV3ZGlyKHtcbiAgICAgIHNvcnRGYWN0b3J5LFxuICAgICAgZmlsdGVyRmFjdG9yeSxcbiAgICAgIHNlYXJjaEZhY3RvcnksXG4gICAgICB0YWJsZVN0YXRlLFxuICAgICAgZGF0YSxcbiAgICAgIHRhYmxlOiBjb3JlVGFibGVcbiAgICB9KSk7XG4gIH0sIGNvcmVUYWJsZSk7XG59IiwiaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5pbXBvcnQgZGF0YVNvdXJjZSBmcm9tICcuLi9saWIvZGF0YVNvdXJjZSc7XG5pbXBvcnQge2RlZmF1bHQgYXMgY3JlYXRlVGFibGV9IGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuXG5jb25zdCBkYXRhU2V0ID0gW1xuICB7aWQ6IDF9LFxuICB7aWQ6IDJ9LFxuICB7aWQ6IDN9LFxuICB7aWQ6IDR9LFxuICB7aWQ6IDV9LFxuICB7aWQ6IDZ9LFxuICB7aWQ6IDd9LFxuICB7aWQ6IDh9XG5dO1xuY29uc3QgaW5pdGlhbFRhYmxlU3RhdGUgPSB7XG4gIHNlYXJjaDoge30sXG4gIGZpbHRlcjoge30sXG4gIHNvcnQ6IHt9LFxuICBzbGljZToge3NpemU6IDIsIHBhZ2U6IDF9XG59O1xuXG5leHBvcnQgZGVmYXVsdCB6b3JhKClcbiAgLnRlc3QoJ3B1bGwgZGF0YSBmcm9tIGRhdGEgc291cmNlIGZyb20gYW4gb2Zmc2V0IHRvIGEgZ2l2ZW4gbnVtYmVyIGJhc2VkIG9uIHRoZSBwYWdlIHNpemUgY29uZicsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCB0YWJsZSA9IGNyZWF0ZVRhYmxlKHtkYXRhOiBkYXRhU2V0LCB0YWJsZVN0YXRlOiBpbml0aWFsVGFibGVTdGF0ZX0pO1xuICAgIGNvbnN0IGRhdGEgPSBkYXRhU291cmNlKHt0YWJsZX0pO1xuICAgIGNvbnN0IGl0ZW1zID0geWllbGQgZGF0YS5wdWxsKDEsIDQpO1xuICAgIHQuZGVlcEVxdWFsKGl0ZW1zLCBbXG4gICAgICB7aW5kZXg6IDEsIHZhbHVlOiB7aWQ6IDJ9fSxcbiAgICAgIHtpbmRleDogMiwgdmFsdWU6IHtpZDogM319LFxuICAgICAge2luZGV4OiAzLCB2YWx1ZToge2lkOiA0fX0sXG4gICAgICB7aW5kZXg6IDQsIHZhbHVlOiB7aWQ6IDV9fVxuICAgIF0pO1xuICB9KTtcbiIsImZ1bmN0aW9uIHdpbmRvdyAoKSB7XG5cbn1cblxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2J1ZmZlclNpemUgPSA2MDAsIHdpbmRvd1NpemUgPSAyMDAsIGluZGV4S2V5ID0gJyQkaW5kZXgnfSA9IHt9KSB7XG5cbiAgY29uc3QgZGF0YUxpc3QgPSBbXTtcbiAgbGV0IHdpbmRvd0N1cnNvciA9IG51bGw7XG5cblxuICBjb25zdCBpbnN0YW5jZSA9IHtcbiAgICAvL3JldHVybiBhIHdpbmRvd1xuICAgIHNsaWRlKG9mZnNldCl7XG5cbiAgICB9LFxuICAgIHB1c2goKXtcbiAgICAgIGNvbnN0IGl0ZW1zID0gWy4uLmFyZ3VtZW50c107XG4gICAgICBjb25zdCB0YWlsSXRlbSA9IGluc3RhbmNlLnRhaWwoKTtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGFpbEl0ZW0gPyB0YWlsSXRlbVtpbmRleEtleV0gKyAxIDogMDtcbiAgICAgIGRhdGFMaXN0LnB1c2goLi4uaXRlbXMubWFwKChpdGVtLCBvZmZzZXQpID0+IE9iamVjdC5hc3NpZ24oe1tpbmRleEtleV06IGluZGV4ICsgb2Zmc2V0fSwgaXRlbSkpKTtcbiAgICB9LFxuICAgIHVuc2hpZnQoLi4uaXRlbXMpe1xuICAgICAgY29uc3QgaXRlbXMgPSBbLi4uYXJndW1lbnRzXTtcbiAgICAgIGNvbnN0IGluZGV4ID0gaW5zdGFuY2UubGVuZ3RoID8gaW5zdGFuY2UubGVuZ3RoIDogMDtcbiAgICAgIGRhdGFMaXN0LnB1c2goLi4uaXRlbXMubWFwKChpdGVtLCBvZmZzZXQpID0+IE9iamVjdC5hc3NpZ24oe1tpbmRleEtleV06IGluZGV4ICsgb2Zmc2V0fSwgaXRlbSkpKTtcbiAgICB9LFxuICAgIGdldChpbmRleCl7XG4gICAgICByZXR1cm4gZGF0YUxpc3QuZmluZChpdGVtID0+IGl0ZW1baW5kZXhLZXldID09PSBpbmRleCk7XG4gICAgfSxcbiAgICBzaGlmdChjb3VudCl7XG4gICAgfSxcbiAgICBwb3AoY291bnQpe1xuICAgIH0sXG4gICAgaGVhZCgpe1xuICAgICAgcmV0dXJuIGRhdGFMaXN0WzBdIHx8IG51bGw7XG4gICAgfSxcbiAgICB0YWlsKCl7XG4gICAgICByZXR1cm4gaW5zdGFuY2UubGVuZ3RoID8gZGF0YUxpc3RbaW5zdGFuY2UubGVuZ3RoIC0gMV0gOiBudWxsO1xuICAgIH0sXG4gICAgc2xpY2UoKXtcbiAgICB9XG5cbiAgfTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoaW5zdGFuY2UsICdsZW5ndGgnLCB7XG4gICAgZ2V0KCl7XG4gICAgICByZXR1cm4gZGF0YUxpc3QubGVuZ3RoO1xuICAgIH1cbiAgfSk7XG5cblxuICByZXR1cm4gaW5zdGFuY2U7XG5cblxufSIsImltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuaW1wb3J0IHtnaXZlTWVOfSBmcm9tICcuLi9saWIvaGVscGVyJ1xuaW1wb3J0IHNsaWRpbmdXaW5kb3cgZnJvbSAnLi4vbGliL3NsaWRpbmdXaW5kb3cnO1xuXG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnc2xpZGluZyB3aW5kb3c6IHB1c2ggbmV3IGl0ZW1zIHNldHRpbmcgaW5kZXhlcycsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBlbnRyaWVzID0gQXJyYXkuZnJvbShnaXZlTWVOKDUpKS5tYXAoaSA9PiBPYmplY3QuYXNzaWduKHt9LCB7aWQ6IGl9KSk7XG4gICAgY29uc3QgdyA9IHNsaWRpbmdXaW5kb3coKTtcbiAgICB3LnB1c2goLi4uZW50cmllcyk7XG4gICAgdC5lcXVhbCh3Lmxlbmd0aCwgNSk7XG4gICAgdC5kZWVwRXF1YWwody5nZXQoMiksIHskJGluZGV4OiAyLCBpZDogMn0pO1xuICAgIHcucHVzaCh7aWQ6IDY2Nn0pO1xuICAgIHQuZGVlcEVxdWFsKHcuZ2V0KDUpLCB7JCRpbmRleDogNSwgaWQ6IDY2Nn0pO1xuICB9KVxuICAudGVzdCgndGFpbCBzaG91bGQgcmV0dXJuIHRoZSBsYXN0IGl0ZW0gb3IgbnVsbCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCB3ID0gc2xpZGluZ1dpbmRvdygpO1xuICAgIHQuZXF1YWwody50YWlsKCksIG51bGwpO1xuICAgIHcucHVzaCh7aWQ6IDF9LCB7aWQ6IDJ9KTtcbiAgICB0LmRlZXBFcXVhbCh3LnRhaWwoKSwgeyQkaW5kZXg6IDEsIGlkOiAyfSk7XG4gIH0pXG4gIC50ZXN0KCdoZWFkIHNob3VsZCByZXR1cm4gdGhlIGZpcnN0IGl0ZW0gb3IgbnVsbCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCB3ID0gc2xpZGluZ1dpbmRvdygpO1xuICAgIHQuZXF1YWwody5oZWFkKCksIG51bGwpO1xuICAgIHcucHVzaCh7aWQ6IDF9LCB7aWQ6IDJ9KTtcbiAgICB0LmRlZXBFcXVhbCh3LmhlYWQoKSwgeyQkaW5kZXg6IDAsIGlkOiAxfSk7XG4gIH0pIiwiaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5pbXBvcnQgaGVscGVyIGZyb20gJy4vaGVscGVyJztcbmltcG9ydCBidWZmZXIgZnJvbSAnLi9pdGVtc0J1ZmZlcic7XG5pbXBvcnQgZGF0YVNvdXJjZSBmcm9tICcuL2RhdGFTb3VyY2UnO1xuaW1wb3J0IHNsaWRpbmdXaW5kb3cgZnJvbSAnLi9zbGlkaW5nV2luZG93Jztcblxuem9yYSgpXG4gIC50ZXN0KGhlbHBlcilcbiAgLy8gLnRlc3QoYnVmZmVyKVxuICAudGVzdChkYXRhU291cmNlKVxuICAudGVzdChzbGlkaW5nV2luZG93KVxuICAucnVuKCk7Il0sIm5hbWVzIjpbInBsYW4iLCJ6b3JhIiwic3dhcCIsImNvbXBvc2UiLCJjdXJyeSIsInRhcCIsInBvaW50ZXIiLCJmaWx0ZXIiLCJzb3J0RmFjdG9yeSIsInNvcnQiLCJzZWFyY2giLCJ0YWJsZSIsImNyZWF0ZVRhYmxlIiwiZGF0YVNvdXJjZSIsInNsaWRpbmdXaW5kb3ciXSwibWFwcGluZ3MiOiI7OztBQUFBOzs7O0FBSUEsSUFBSSxLQUFLLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUM7Ozs7OztBQU1sQyxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7Ozs7Ozs7Ozs7Ozs7O0FBY3ZDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsVUFBVSxFQUFFLEVBQUU7RUFDdEIsYUFBYSxDQUFDLHFCQUFxQixHQUFHLEVBQUUsQ0FBQztFQUN6QyxPQUFPLGFBQWEsQ0FBQztFQUNyQixTQUFTLGFBQWEsR0FBRztJQUN2QixPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7R0FDakQ7Q0FDRixDQUFDOzs7Ozs7Ozs7OztBQVdGLFNBQVMsRUFBRSxDQUFDLEdBQUcsRUFBRTtFQUNmLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQztFQUNmLElBQUksSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDOzs7OztFQUtwQyxPQUFPLElBQUksT0FBTyxDQUFDLFNBQVMsT0FBTyxFQUFFLE1BQU0sRUFBRTtJQUMzQyxJQUFJLE9BQU8sR0FBRyxLQUFLLFVBQVUsRUFBRSxHQUFHLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDMUQsSUFBSSxDQUFDLEdBQUcsSUFBSSxPQUFPLEdBQUcsQ0FBQyxJQUFJLEtBQUssVUFBVSxFQUFFLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDOztJQUVoRSxXQUFXLEVBQUUsQ0FBQzs7Ozs7Ozs7SUFRZCxTQUFTLFdBQVcsQ0FBQyxHQUFHLEVBQUU7TUFDeEIsSUFBSSxHQUFHLENBQUM7TUFDUixJQUFJO1FBQ0YsR0FBRyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7T0FDckIsQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUNWLE9BQU8sTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO09BQ2xCO01BQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0tBQ1g7Ozs7Ozs7O0lBUUQsU0FBUyxVQUFVLENBQUMsR0FBRyxFQUFFO01BQ3ZCLElBQUksR0FBRyxDQUFDO01BQ1IsSUFBSTtRQUNGLEdBQUcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO09BQ3RCLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDVixPQUFPLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztPQUNsQjtNQUNELElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUNYOzs7Ozs7Ozs7OztJQVdELFNBQVMsSUFBSSxDQUFDLEdBQUcsRUFBRTtNQUNqQixJQUFJLEdBQUcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO01BQ3hDLElBQUksS0FBSyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztNQUMzQyxJQUFJLEtBQUssSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLEVBQUUsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQztNQUMxRSxPQUFPLFVBQVUsQ0FBQyxJQUFJLFNBQVMsQ0FBQyx1RUFBdUU7VUFDbkcsd0NBQXdDLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQzFFO0dBQ0YsQ0FBQyxDQUFDO0NBQ0o7Ozs7Ozs7Ozs7QUFVRCxTQUFTLFNBQVMsQ0FBQyxHQUFHLEVBQUU7RUFDdEIsSUFBSSxDQUFDLEdBQUcsRUFBRSxPQUFPLEdBQUcsQ0FBQztFQUNyQixJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsRUFBRSxPQUFPLEdBQUcsQ0FBQztFQUMvQixJQUFJLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxHQUFHLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0VBQzVFLElBQUksVUFBVSxJQUFJLE9BQU8sR0FBRyxFQUFFLE9BQU8sY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7RUFDcEUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLE9BQU8sY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7RUFDOUQsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsT0FBTyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztFQUMxRCxPQUFPLEdBQUcsQ0FBQztDQUNaOzs7Ozs7Ozs7O0FBVUQsU0FBUyxjQUFjLENBQUMsRUFBRSxFQUFFO0VBQzFCLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQztFQUNmLE9BQU8sSUFBSSxPQUFPLENBQUMsVUFBVSxPQUFPLEVBQUUsTUFBTSxFQUFFO0lBQzVDLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLFVBQVUsR0FBRyxFQUFFLEdBQUcsRUFBRTtNQUMvQixJQUFJLEdBQUcsRUFBRSxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztNQUM1QixJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztNQUN6RCxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDZCxDQUFDLENBQUM7R0FDSixDQUFDLENBQUM7Q0FDSjs7Ozs7Ozs7Ozs7QUFXRCxTQUFTLGNBQWMsQ0FBQyxHQUFHLEVBQUU7RUFDM0IsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7Q0FDOUM7Ozs7Ozs7Ozs7O0FBV0QsU0FBUyxlQUFlLENBQUMsR0FBRyxDQUFDO0VBQzNCLElBQUksT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDO0VBQ3BDLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7RUFDNUIsSUFBSSxRQUFRLEdBQUcsRUFBRSxDQUFDO0VBQ2xCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0lBQ3BDLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsQixJQUFJLE9BQU8sR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUM3QyxJQUFJLE9BQU8sSUFBSSxTQUFTLENBQUMsT0FBTyxDQUFDLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztTQUNsRCxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0dBQzlCO0VBQ0QsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZO0lBQzVDLE9BQU8sT0FBTyxDQUFDO0dBQ2hCLENBQUMsQ0FBQzs7RUFFSCxTQUFTLEtBQUssQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFOztJQUUzQixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsU0FBUyxDQUFDO0lBQ3pCLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRTtNQUN4QyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0tBQ3BCLENBQUMsQ0FBQyxDQUFDO0dBQ0w7Q0FDRjs7Ozs7Ozs7OztBQVVELFNBQVMsU0FBUyxDQUFDLEdBQUcsRUFBRTtFQUN0QixPQUFPLFVBQVUsSUFBSSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUM7Q0FDdEM7Ozs7Ozs7Ozs7QUFVRCxTQUFTLFdBQVcsQ0FBQyxHQUFHLEVBQUU7RUFDeEIsT0FBTyxVQUFVLElBQUksT0FBTyxHQUFHLENBQUMsSUFBSSxJQUFJLFVBQVUsSUFBSSxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUM7Q0FDeEU7Ozs7Ozs7OztBQVNELFNBQVMsbUJBQW1CLENBQUMsR0FBRyxFQUFFO0VBQ2hDLElBQUksV0FBVyxHQUFHLEdBQUcsQ0FBQyxXQUFXLENBQUM7RUFDbEMsSUFBSSxDQUFDLFdBQVcsRUFBRSxPQUFPLEtBQUssQ0FBQztFQUMvQixJQUFJLG1CQUFtQixLQUFLLFdBQVcsQ0FBQyxJQUFJLElBQUksbUJBQW1CLEtBQUssV0FBVyxDQUFDLFdBQVcsRUFBRSxPQUFPLElBQUksQ0FBQztFQUM3RyxPQUFPLFdBQVcsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7Q0FDM0M7Ozs7Ozs7Ozs7QUFVRCxTQUFTLFFBQVEsQ0FBQyxHQUFHLEVBQUU7RUFDckIsT0FBTyxNQUFNLElBQUksR0FBRyxDQUFDLFdBQVcsQ0FBQztDQUNsQzs7QUFFRCxTQUFTLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUU7Q0FDekMsT0FBTyxNQUFNLEdBQUcsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQztDQUM1RTs7QUFFRCxJQUFJLElBQUksR0FBRyxvQkFBb0IsQ0FBQyxVQUFVLE1BQU0sRUFBRSxPQUFPLEVBQUU7QUFDM0QsT0FBTyxHQUFHLE1BQU0sQ0FBQyxPQUFPLEdBQUcsT0FBTyxNQUFNLENBQUMsSUFBSSxLQUFLLFVBQVU7SUFDeEQsTUFBTSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7O0FBRXZCLE9BQU8sQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ3BCLFNBQVMsSUFBSSxFQUFFLEdBQUcsRUFBRTtFQUNsQixJQUFJLElBQUksR0FBRyxFQUFFLENBQUM7RUFDZCxLQUFLLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0VBQ3BDLE9BQU8sSUFBSSxDQUFDO0NBQ2I7Q0FDQSxDQUFDLENBQUM7O0FBRUgsSUFBSSxZQUFZLEdBQUcsb0JBQW9CLENBQUMsVUFBVSxNQUFNLEVBQUUsT0FBTyxFQUFFO0FBQ25FLElBQUksc0JBQXNCLEdBQUcsQ0FBQyxVQUFVO0VBQ3RDLE9BQU8sTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztDQUNqRCxHQUFHLElBQUksb0JBQW9CLENBQUM7O0FBRTdCLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxHQUFHLHNCQUFzQixHQUFHLFNBQVMsR0FBRyxXQUFXLENBQUM7O0FBRTVFLE9BQU8sQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO0FBQzlCLFNBQVMsU0FBUyxDQUFDLE1BQU0sRUFBRTtFQUN6QixPQUFPLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxvQkFBb0IsQ0FBQztDQUN2RTs7QUFFRCxPQUFPLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztBQUNsQyxTQUFTLFdBQVcsQ0FBQyxNQUFNLENBQUM7RUFDMUIsT0FBTyxNQUFNO0lBQ1gsT0FBTyxNQUFNLElBQUksUUFBUTtJQUN6QixPQUFPLE1BQU0sQ0FBQyxNQUFNLElBQUksUUFBUTtJQUNoQyxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQztJQUN0RCxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUM7SUFDN0QsS0FBSyxDQUFDO0NBQ1Q7Q0FDQSxDQUFDLENBQUM7O0FBRUgsSUFBSSxPQUFPLEdBQUcsb0JBQW9CLENBQUMsVUFBVSxNQUFNLEVBQUU7QUFDckQsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUM7QUFDbkMsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDO0FBQ3RCLElBQUksV0FBVyxHQUFHLFlBQVksQ0FBQzs7QUFFL0IsSUFBSSxTQUFTLEdBQUcsTUFBTSxDQUFDLE9BQU8sR0FBRyxVQUFVLE1BQU0sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFO0VBQ2pFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQzs7RUFFckIsSUFBSSxNQUFNLEtBQUssUUFBUSxFQUFFO0lBQ3ZCLE9BQU8sSUFBSSxDQUFDOztHQUViLE1BQU0sSUFBSSxNQUFNLFlBQVksSUFBSSxJQUFJLFFBQVEsWUFBWSxJQUFJLEVBQUU7SUFDN0QsT0FBTyxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUssUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDOzs7O0dBSWhELE1BQU0sSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLFFBQVEsSUFBSSxPQUFPLE1BQU0sSUFBSSxRQUFRLElBQUksT0FBTyxRQUFRLElBQUksUUFBUSxFQUFFO0lBQzNGLE9BQU8sSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLEtBQUssUUFBUSxHQUFHLE1BQU0sSUFBSSxRQUFRLENBQUM7Ozs7Ozs7O0dBUS9ELE1BQU07SUFDTCxPQUFPLFFBQVEsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO0dBQ3pDO0NBQ0YsQ0FBQzs7QUFFRixTQUFTLGlCQUFpQixDQUFDLEtBQUssRUFBRTtFQUNoQyxPQUFPLEtBQUssS0FBSyxJQUFJLElBQUksS0FBSyxLQUFLLFNBQVMsQ0FBQztDQUM5Qzs7QUFFRCxTQUFTLFFBQVEsRUFBRSxDQUFDLEVBQUU7RUFDcEIsSUFBSSxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksT0FBTyxDQUFDLENBQUMsTUFBTSxLQUFLLFFBQVEsRUFBRSxPQUFPLEtBQUssQ0FBQztFQUM5RSxJQUFJLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxVQUFVLElBQUksT0FBTyxDQUFDLENBQUMsS0FBSyxLQUFLLFVBQVUsRUFBRTtJQUNqRSxPQUFPLEtBQUssQ0FBQztHQUNkO0VBQ0QsSUFBSSxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxRQUFRLEVBQUUsT0FBTyxLQUFLLENBQUM7RUFDM0QsT0FBTyxJQUFJLENBQUM7Q0FDYjs7QUFFRCxTQUFTLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRTtFQUM1QixJQUFJLENBQUMsRUFBRSxHQUFHLENBQUM7RUFDWCxJQUFJLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxJQUFJLGlCQUFpQixDQUFDLENBQUMsQ0FBQztJQUM5QyxPQUFPLEtBQUssQ0FBQzs7RUFFZixJQUFJLENBQUMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLFNBQVMsRUFBRSxPQUFPLEtBQUssQ0FBQzs7O0VBRzlDLElBQUksV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ2xCLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUU7TUFDbkIsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUNELENBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ25CLENBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ25CLE9BQU8sU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7R0FDOUI7RUFDRCxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRTtJQUNmLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUU7TUFDaEIsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUNELElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsTUFBTSxFQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ3hDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtNQUM3QixJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxLQUFLLENBQUM7S0FDakM7SUFDRCxPQUFPLElBQUksQ0FBQztHQUNiO0VBQ0QsSUFBSTtJQUNGLElBQUksRUFBRSxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDbEIsRUFBRSxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztHQUN4QixDQUFDLE9BQU8sQ0FBQyxFQUFFO0lBQ1YsT0FBTyxLQUFLLENBQUM7R0FDZDs7O0VBR0QsSUFBSSxFQUFFLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxNQUFNO0lBQ3hCLE9BQU8sS0FBSyxDQUFDOztFQUVmLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztFQUNWLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQzs7RUFFVixLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0lBQ25DLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7TUFDaEIsT0FBTyxLQUFLLENBQUM7R0FDaEI7OztFQUdELEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7SUFDbkMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNaLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsRUFBRSxPQUFPLEtBQUssQ0FBQztHQUNwRDtFQUNELE9BQU8sT0FBTyxDQUFDLEtBQUssT0FBTyxDQUFDLENBQUM7Q0FDOUI7Q0FDQSxDQUFDLENBQUM7O0FBRUgsTUFBTSxVQUFVLEdBQUc7RUFDakIsRUFBRSxDQUFDLEdBQUcsRUFBRSxPQUFPLEdBQUcsa0JBQWtCLEVBQUU7SUFDcEMsTUFBTSxlQUFlLEdBQUc7TUFDdEIsSUFBSSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUM7TUFDbEIsUUFBUSxFQUFFLFFBQVE7TUFDbEIsTUFBTSxFQUFFLEdBQUc7TUFDWCxRQUFRLEVBQUUsSUFBSTtNQUNkLE9BQU87S0FDUixDQUFDO0lBQ0YsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDeEMsT0FBTyxlQUFlLENBQUM7R0FDeEI7RUFDRCxTQUFTLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLEdBQUcsc0JBQXNCLEVBQUU7SUFDNUQsTUFBTSxlQUFlLEdBQUc7TUFDdEIsSUFBSSxFQUFFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDO01BQy9CLE1BQU07TUFDTixRQUFRO01BQ1IsT0FBTztNQUNQLFFBQVEsRUFBRSxXQUFXO0tBQ3RCLENBQUM7SUFDRixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUN4QyxPQUFPLGVBQWUsQ0FBQztHQUN4QjtFQUNELEtBQUssQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLE9BQU8sR0FBRyxpQkFBaUIsRUFBRTtJQUNuRCxNQUFNLGVBQWUsR0FBRztNQUN0QixJQUFJLEVBQUUsTUFBTSxLQUFLLFFBQVE7TUFDekIsTUFBTTtNQUNOLFFBQVE7TUFDUixPQUFPO01BQ1AsUUFBUSxFQUFFLE9BQU87S0FDbEIsQ0FBQztJQUNGLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ3hDLE9BQU8sZUFBZSxDQUFDO0dBQ3hCO0VBQ0QsS0FBSyxDQUFDLEdBQUcsRUFBRSxPQUFPLEdBQUcsc0JBQXNCLEVBQUU7SUFDM0MsTUFBTSxlQUFlLEdBQUc7TUFDdEIsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQztNQUNuQixRQUFRLEVBQUUsT0FBTztNQUNqQixNQUFNLEVBQUUsR0FBRztNQUNYLFFBQVEsRUFBRSxPQUFPO01BQ2pCLE9BQU87S0FDUixDQUFDO0lBQ0YsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDeEMsT0FBTyxlQUFlLENBQUM7R0FDeEI7RUFDRCxZQUFZLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLEdBQUcsMEJBQTBCLEVBQUU7SUFDbkUsTUFBTSxlQUFlLEdBQUc7TUFDdEIsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUM7TUFDaEMsTUFBTTtNQUNOLFFBQVE7TUFDUixPQUFPO01BQ1AsUUFBUSxFQUFFLGNBQWM7S0FDekIsQ0FBQztJQUNGLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ3hDLE9BQU8sZUFBZSxDQUFDO0dBQ3hCO0VBQ0QsUUFBUSxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsT0FBTyxHQUFHLHFCQUFxQixFQUFFO0lBQzFELE1BQU0sZUFBZSxHQUFHO01BQ3RCLElBQUksRUFBRSxNQUFNLEtBQUssUUFBUTtNQUN6QixNQUFNO01BQ04sUUFBUTtNQUNSLE9BQU87TUFDUCxRQUFRLEVBQUUsVUFBVTtLQUNyQixDQUFDO0lBQ0YsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDeEMsT0FBTyxlQUFlLENBQUM7R0FDeEI7RUFDRCxNQUFNLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7SUFDOUIsSUFBSSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQztJQUN6QixJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsRUFBRTtNQUNoQyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztLQUMzQztJQUNELElBQUk7TUFDRixJQUFJLEVBQUUsQ0FBQztLQUNSLENBQUMsT0FBTyxLQUFLLEVBQUU7TUFDZCxNQUFNLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNsQjtJQUNELElBQUksR0FBRyxNQUFNLEtBQUssU0FBUyxDQUFDO0lBQzVCLE1BQU0sR0FBRyxNQUFNLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQztJQUNoQyxJQUFJLFFBQVEsWUFBWSxNQUFNLEVBQUU7TUFDOUIsSUFBSSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO01BQ3hFLFFBQVEsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDN0IsTUFBTSxJQUFJLE9BQU8sUUFBUSxLQUFLLFVBQVUsSUFBSSxNQUFNLEVBQUU7TUFDbkQsSUFBSSxHQUFHLE1BQU0sWUFBWSxRQUFRLENBQUM7TUFDbEMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUM7S0FDN0I7SUFDRCxNQUFNLGVBQWUsR0FBRztNQUN0QixJQUFJO01BQ0osUUFBUTtNQUNSLE1BQU07TUFDTixRQUFRLEVBQUUsUUFBUTtNQUNsQixPQUFPLEVBQUUsT0FBTyxJQUFJLGNBQWM7S0FDbkMsQ0FBQztJQUNGLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ3hDLE9BQU8sZUFBZSxDQUFDO0dBQ3hCO0VBQ0QsWUFBWSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO0lBQ3BDLElBQUksTUFBTSxDQUFDO0lBQ1gsSUFBSSxPQUFPLFFBQVEsS0FBSyxRQUFRLEVBQUU7TUFDaEMsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7S0FDM0M7SUFDRCxJQUFJO01BQ0YsSUFBSSxFQUFFLENBQUM7S0FDUixDQUFDLE9BQU8sS0FBSyxFQUFFO01BQ2QsTUFBTSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDbEI7SUFDRCxNQUFNLGVBQWUsR0FBRztNQUN0QixJQUFJLEVBQUUsTUFBTSxLQUFLLFNBQVM7TUFDMUIsUUFBUSxFQUFFLGlCQUFpQjtNQUMzQixNQUFNLEVBQUUsTUFBTSxJQUFJLE1BQU0sQ0FBQyxLQUFLO01BQzlCLFFBQVEsRUFBRSxjQUFjO01BQ3hCLE9BQU8sRUFBRSxPQUFPLElBQUksa0JBQWtCO0tBQ3ZDLENBQUM7SUFDRixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUN4QyxPQUFPLGVBQWUsQ0FBQztHQUN4QjtFQUNELElBQUksQ0FBQyxNQUFNLEdBQUcsYUFBYSxFQUFFO0lBQzNCLE1BQU0sZUFBZSxHQUFHO01BQ3RCLElBQUksRUFBRSxLQUFLO01BQ1gsTUFBTSxFQUFFLGFBQWE7TUFDckIsUUFBUSxFQUFFLGlCQUFpQjtNQUMzQixPQUFPLEVBQUUsTUFBTTtNQUNmLFFBQVEsRUFBRSxNQUFNO0tBQ2pCLENBQUM7SUFDRixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUN4QyxPQUFPLGVBQWUsQ0FBQztHQUN4QjtDQUNGLENBQUM7O0FBRUYsU0FBUyxTQUFTLEVBQUUsSUFBSSxFQUFFO0VBQ3hCLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3pEOztBQUVELE1BQU0sSUFBSSxHQUFHO0VBQ1gsR0FBRyxFQUFFLFlBQVk7SUFDZixNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0IsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ3ZCLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7T0FDakMsSUFBSSxDQUFDLE1BQU07UUFDVixPQUFPLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsYUFBYSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQztPQUN2RSxDQUFDLENBQUM7R0FDTjtFQUNELFlBQVksRUFBRTtJQUNaLE1BQU0sYUFBYSxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxhQUFhLENBQUMsQ0FBQztJQUN2QyxPQUFPLElBQUksQ0FBQztHQUNiO0NBQ0YsQ0FBQzs7QUFFRixTQUFTLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxTQUFTLEVBQUUsSUFBSSxHQUFHLEtBQUssQ0FBQyxFQUFFO0VBQ3JELE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUU7SUFDekIsV0FBVyxFQUFFLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQztJQUNqQyxTQUFTLEVBQUUsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDO0lBQzdCLFVBQVUsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUM7SUFDdkIsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQztJQUNuQixNQUFNLEVBQUU7TUFDTixHQUFHLEVBQUU7UUFDSCxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTTtPQUM5QjtLQUNGO0dBQ0YsQ0FBQyxDQUFDO0NBQ0o7O0FBRUQsU0FBUyxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxFQUFFO0VBQ3ZDLE1BQU0sTUFBTSxHQUFHLElBQUksS0FBSyxJQUFJLEdBQUcsSUFBSSxHQUFHLFFBQVEsQ0FBQztFQUMvQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUNqRDs7QUFFRCxTQUFTLE9BQU8sSUFBSTtFQUNsQixPQUFPLE9BQU8sT0FBTyxLQUFLLFdBQVcsSUFBSSxPQUFPLE9BQU8sQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDO0NBQzdFOztBQUVELFNBQVMsR0FBRyxJQUFJO0VBQ2QsT0FBTyxjQUFjO0lBQ25CLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztJQUNkLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztJQUNmLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQztJQUNoQixJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUM7O0lBRWhCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUM1QixPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDOUIsSUFBSTtNQUNGLE9BQU8sSUFBSSxFQUFFO1FBQ1gsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7VUFDM0IsT0FBTyxFQUFFLENBQUM7U0FDWCxNQUFNO1VBQ0wsT0FBTyxFQUFFLENBQUM7U0FDWDtRQUNELFNBQVMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLElBQUksU0FBUyxDQUFDLEVBQUUsS0FBSyxNQUFNLEVBQUU7VUFDM0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxTQUFTLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7VUFDekUsTUFBTSxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUM7U0FDdkI7UUFDRCxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDbEIsSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRTtVQUMzQixPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDWCxFQUFFLFNBQVMsQ0FBQyxRQUFRLENBQUM7WUFDckIsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztVQUN2QyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ3hDLENBQUMsQ0FBQyxDQUFDO1NBQ0M7UUFDRCxLQUFLLEVBQUUsQ0FBQztPQUNUO0tBQ0YsQ0FBQyxPQUFPLENBQUMsRUFBRTtNQUNWLE9BQU8sQ0FBQyxHQUFHLENBQUMsK0JBQStCLENBQUMsQ0FBQztNQUM3QyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO01BQ2YsSUFBSSxPQUFPLEVBQUUsRUFBRTtRQUNiLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7T0FDakI7S0FDRjtZQUNPO01BQ04sTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLFFBQVEsQ0FBQztNQUN4QyxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUU7UUFDYixPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7R0FDbEIsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDO1dBQ0osRUFBRSxTQUFTLENBQUM7VUFDYixFQUFFLE9BQU8sQ0FBQztVQUNWLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO09BQ2hCO01BQ0QsSUFBSSxPQUFPLElBQUksT0FBTyxFQUFFLEVBQUU7UUFDeEIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztPQUNqQjtLQUNGO0dBQ0YsQ0FBQztDQUNIOztBQUVELE1BQU0sSUFBSSxHQUFHO0VBQ1gsSUFBSSxDQUFDLFdBQVcsRUFBRSxTQUFTLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNyQyxNQUFNLFNBQVMsR0FBRyxDQUFDLENBQUMsU0FBUyxJQUFJLFdBQVcsQ0FBQyxLQUFLLElBQUksQ0FBQyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztJQUNwRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNuRSxPQUFPLElBQUksQ0FBQztHQUNiOztFQUVELElBQUksQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDO0lBQzFCLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsU0FBUyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7R0FDeEQ7O0VBRUQsR0FBRyxDQUFDLElBQUksR0FBRyxHQUFHLEVBQUUsQ0FBQztJQUNmLE1BQU0sWUFBWSxHQUFHLElBQUksRUFBRSxDQUFDO0lBQzVCLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNwQixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzNDLE1BQU0sUUFBUSxHQUFHLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDckUsT0FBTyxLQUFLLENBQUMsY0FBYztNQUN6QixJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7TUFDWCxJQUFJO1FBQ0YsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDekMsS0FBSyxJQUFJLENBQUMsSUFBSSxPQUFPLEVBQUU7VUFDckIsTUFBTSxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztVQUM1QyxLQUFLLElBQUksTUFBTSxJQUFJLFVBQVUsRUFBRTtZQUM3QixZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQztXQUMvRDtVQUNELEVBQUUsRUFBRSxDQUFDO1NBQ047T0FDRjtNQUNELE9BQU8sQ0FBQyxFQUFFO1FBQ1IsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztPQUN2QixTQUFTO1FBQ1IsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDO09BQ3ZCO0tBQ0YsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7R0FDZDs7RUFFRCxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRTtJQUNuQixLQUFLLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7TUFDeEIsTUFBTSxDQUFDLENBQUM7S0FDVDtHQUNGO0NBQ0YsQ0FBQzs7QUFFRixTQUFTQSxNQUFJLElBQUk7RUFDZixPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFO0lBQ3pCLEtBQUssRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUM7SUFDbEIsTUFBTSxFQUFFO01BQ04sR0FBRyxFQUFFO1FBQ0gsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU07T0FDekI7S0FDRjtHQUNGLENBQUMsQ0FBQztDQUNKLEFBRUQsQUFBb0I7O0FDdG9CYixTQUFTLEtBQUssRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFO0VBQ3BDLE1BQU0sS0FBSyxHQUFHLFNBQVMsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDO0VBQ3JDLE9BQU8sQ0FBQyxHQUFHLElBQUksS0FBSztJQUNsQixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUNuQyxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUU7TUFDdkIsT0FBTyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztLQUNwQixNQUFNO01BQ0wsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLFFBQVEsS0FBSyxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQztNQUN2RCxPQUFPLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUN6QztHQUNGLENBQUM7Q0FDSCxBQUVELEFBQU8sQUFFTixBQUVELEFBQU87O0FDdkJBLFVBQVUsT0FBTyxFQUFFLENBQUMsRUFBRTtFQUMzQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0lBQzFCLE1BQU0sQ0FBQyxDQUFDO0dBQ1Q7Q0FDRjs7QUFFRCxBQUFPLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxLQUFLLEdBQUcsQ0FBQyxLQUFLO0VBQy9DLE1BQU0sQ0FBQyxHQUFHLEtBQUssSUFBSSxDQUFDLENBQUM7RUFDckIsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7Q0FDckMsRUFBRSxDQUFDLENBQUMsQ0FBQzs7QUNSTixhQUFlQyxNQUFJLEVBQUU7R0FDbEIsSUFBSSxDQUFDLFdBQVcsRUFBRSxZQUFZLENBQUMsRUFBRTtJQUNoQyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDMUIsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztHQUNsQyxDQUFDO0dBQ0QsSUFBSSxDQUFDLGNBQWMsRUFBRSxZQUFZLENBQUMsRUFBRTtJQUNuQyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUN6QixDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztHQUNwQixDQUFDO0dBQ0QsSUFBSSxDQUFDLFlBQVksRUFBRSxZQUFZLENBQUMsRUFBRTtJQUNqQyxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDaEIsUUFBUSxDQUFDLE1BQU0sT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDN0IsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7R0FDckIsQ0FBQztHQUNELElBQUksQ0FBQyxzQkFBc0IsRUFBRSxZQUFZLENBQUMsRUFBRTtJQUMzQyxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDaEIsUUFBUSxDQUFDLE1BQU0sT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM3QixDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztHQUNyQixDQUFDO0dBQ0QsSUFBSSxDQUFDLG9CQUFvQixFQUFFLFlBQVksQ0FBQyxFQUFFO0lBQ3pDLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQztJQUNoQixRQUFRLENBQUMsTUFBTSxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUM7SUFDNUIsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7R0FDckIsQ0FBQzs7QUN4QkosTUFBTSxZQUFZLEdBQUcsQ0FBQyxFQUFFLEVBQUUsR0FBRyxLQUFLO0VBQ2hDLElBQUksR0FBRyxFQUFFO0lBQ1AsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0dBQ1Q7Q0FDRixDQUFDOztBQUVGLGFBQWUsVUFBVSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7RUFDL0MsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDO0VBQ3ZCLE1BQU0sUUFBUSxHQUFHO0lBQ2YsR0FBRyxFQUFFLFFBQVEsQ0FBQyxNQUFNO01BQ2xCLFlBQVksQ0FBQyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxFQUFFLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0tBQzdELENBQUM7SUFDRixLQUFLLEVBQUUsUUFBUSxDQUFDLE1BQU07TUFDcEIsWUFBWSxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUUsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7S0FDL0QsQ0FBQztJQUNGLE9BQU8sRUFBRTtNQUNQLFdBQVcsQ0FBQyxPQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQztNQUNsQyxZQUFZLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDeEU7SUFDRCxJQUFJLEVBQUU7TUFDSixXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUM7TUFDL0IsWUFBWSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQzFFO0lBQ0QsR0FBRyxDQUFDLEtBQUssQ0FBQztNQUNSLE9BQU8sV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxLQUFLLENBQUMsQ0FBQztLQUN2RDtJQUNELEtBQUssRUFBRSxZQUFZLEtBQUssRUFBRSxDQUFDLEVBQUU7TUFDM0IsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUMxQixNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNyQyxJQUFJLElBQUksRUFBRTtVQUNSLE1BQU0sSUFBSSxDQUFDO1NBQ1o7T0FDRjtLQUNGO0lBQ0QsSUFBSSxFQUFFO01BQ0osT0FBTyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDdkI7SUFDRCxJQUFJLEVBQUU7TUFDSixPQUFPLFdBQVcsQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQzVDO0lBQ0QsUUFBUSxDQUFDLEtBQUssQ0FBQztNQUNiLE9BQU8sV0FBVyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQztLQUN0RTtHQUNGLENBQUM7O0VBRUYsTUFBTSxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFO0lBQ3hDLEdBQUcsRUFBRSxNQUFNLFdBQVcsQ0FBQyxNQUFNO0dBQzlCLENBQUMsQ0FBQzs7RUFFSCxPQUFPLFFBQVEsQ0FBQztDQUNqQjs7QUNqREQsTUFBTSxXQUFXLEdBQUcsQ0FBQyxJQUFJLEtBQUs7O0VBRTVCLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQzs7RUFFcEIsTUFBTSxHQUFHLEdBQUc7SUFDVixLQUFLLEVBQUU7TUFDTCxPQUFPLEdBQUcsSUFBSSxDQUFBO0tBQ2Y7R0FDRixDQUFDOztFQUVGLE1BQU0sQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRTtJQUNwQyxHQUFHLEVBQUU7TUFDSCxPQUFPLE9BQU8sQ0FBQztLQUNoQjtHQUNGLENBQUMsQ0FBQzs7RUFFSCxPQUFPO0lBQ0wsR0FBRztJQUNILEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtHQUNYLENBQUM7Q0FDSCxDQUFDOztBQUVGLEFBQWVBLE1BQUksRUFBRTtHQUNsQixJQUFJLENBQUMscUJBQXFCLEVBQUUsWUFBWSxDQUFDLEVBQUU7SUFDMUMsTUFBTSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUM7SUFDbkIsTUFBTSxJQUFJLEdBQUcsV0FBVyxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDcEMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNiLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNyQixDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2pDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUNSLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNyQixDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0dBQ2pDLENBQUM7R0FDRCxJQUFJLENBQUMsdUJBQXVCLEVBQUUsWUFBWSxDQUFDLEVBQUU7SUFDNUMsTUFBTSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUM7SUFDbkIsTUFBTSxJQUFJLEdBQUcsV0FBVyxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDcEMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNiLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNyQixDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2pDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNWLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNyQixDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxF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

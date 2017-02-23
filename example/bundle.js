(function () {
'use strict';

function swap (f) {
  return (a, b) => f(b, a);
}

function compose (first, ...fns) {
  return (...args) => fns.reduce((previous, current) => current(previous), first(...args));
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



function tap (fn) {
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
  const compareFunc = direction === 'desc' ? swap(orderFunc) : orderFunc;

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
      return compose(String, (val) => val.toLowerCase());
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
  const operateOnTyped = compose(typeIt, operators[operator]);
  const predicateFunc = operateOnTyped(value);
  return compose(typeIt, predicateFunc);
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
    return compose(getter, every(clauses));
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
  return {get, set: curry(set)};
}

var table$2 = function ({
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

  const safeAssign = curry((base, extension) => Object.assign({}, base, extension));
  const dispatch = curry(table.dispatch.bind(table), 2);

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
        const execFunc = compose(filterFunc, searchFunc, tap(createSummary), sortFunc, sliceFunc);
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

  const updateTableState = curry((pter, ev, newPartialState) => compose(
    safeAssign(pter.get(tableState)),
    tap(dispatch(ev)),
    pter.set(tableState)
  )(newPartialState));

  const resetToFirstPage = () => updateTableState(slicePointer, PAGE_CHANGED, {page: 1});

  const tableOperation = (pter, ev) => compose(
    updateTableState(pter, ev),
    resetToFirstPage,
    () => table.exec() // we wrap within a function so table.exec can be overwritten (when using with a server for example)
  );

  const api = {
    sort: tableOperation(sortPointer, TOGGLE_SORT),
    filter: tableOperation(filterPointer, FILTER_CHANGED),
    search: tableOperation(searchPointer, SEARCH_CHANGED),
    slice: compose(updateTableState(slicePointer, PAGE_CHANGED), () => table.exec()),
    exec,
    eval(state = tableState){
      return Promise.resolve()
        .then(function () {
          const sortFunc = sortFactory(sortPointer.get(state));
          const searchFunc = searchFactory(searchPointer.get(state));
          const filterFunc = filterFactory(filterPointer.get(state));
          const sliceFunc = sliceFactory(slicePointer.get(state));
          const execFunc = compose(filterFunc, searchFunc, sortFunc, sliceFunc);
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

var table$1 = function ({
  sortFactory: sortFactory$$1 = sortFactory,
  filterFactory = filter$1,
  searchFactory = search$1,
  tableState = {sort: {}, slice: {page: 1}, filter: {}, search: {}},
  data = []
}, ...tableDirectives) {

  const coreTable = table$2({sortFactory: sortFactory$$1, filterFactory, tableState, data, searchFactory});

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

function* giveMeN (n) {
  for (let i = 0; i < n; i++) {
    yield i;
  }
}

const doNTimes = curry$1((fn, count = 1) => {
  const n = count || 1;
  [...giveMeN(n)].forEach(() => fn());
}, 2);

var dataSource = function ({table}) {
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

var slidingWindow = function ({bufferSize = 1000, windowSize = 200, indexKey = '$$index'} = {}) {

  const dataList = [];
  let windowCursor = null;

  const instance = {
    push(){
      const items = [...arguments];
      const maxRemovableItemCount = Math.min(dataList.indexOf(windowCursor), items.length);
      const limit = dataList.length < bufferSize ? bufferSize - dataList.length : maxRemovableItemCount;
      const toAppend = items.slice(0, limit);
      const tailItem = instance.tail();
      const startIndex = tailItem ? tailItem[indexKey] + 1 : 0;
      dataList.push(...toAppend.map((item, offset) => Object.assign({[indexKey]: startIndex + offset}, item)));
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
      const upperWindowIndex = (dataList.indexOf(windowCursor) + windowSize);
      const maxRemovableItemCount = Math.min(dataList.length - upperWindowIndex, items.length);
      const limit = dataList.length < bufferSize ? bufferSize - dataList.length : maxRemovableItemCount;
      const toPrepend = items.slice(0, limit);
      const startIndex = instance.head()[indexKey] - limit;
      dataList.unshift(...toPrepend.map((item, offset) => Object.assign({[indexKey]: startIndex + offset}, item)));
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
      return dataList.find(item => item[indexKey] === index);
    },
    head(){
      return dataList[0] || null;
    },
    tail(){
      return dataList.length ? dataList[dataList.length - 1] : null;
    },
    slide(offset){
      const cursorIndex = dataList.indexOf(windowCursor) || 0;
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

var containerFactory = function ({element, windowSize}) {

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

var virtualizer = function ({container, table, rowFactory, indexKey = '$$index', windowSize = 200, bufferSize = 1000, treshold = 0.8}) {
  let sourceStream = null;
  let sw = null;
  let lastScroll;
  let anteLastScroll;
  let fetching = false;

  const bufferRefresh = 0.5;
  const bufferRefreshSize = bufferRefresh * bufferSize / 2;

  const containerInterface = containerFactory({element: container, windowSize});

  const scrollDown = (scrollRatio) => {
    if (scrollRatio > treshold) {
      const toAppend = Math.floor(windowSize * (1 - scrollRatio));
      const {shift, slice:nodes} = sw.slide(toAppend);
      if (shift !== 0) {
        containerInterface.append(...nodes.slice(-shift).map(n => n.dom()));
      }
      const position = sw.position();
      if (position > bufferRefresh && fetching === false) {
        const tailIndex = sw.tail()[indexKey];
        fetching = true;
        sourceStream.pull(tailIndex + 1, bufferRefreshSize)
          .then(items => {
            sw.push(...items.map(rowFactory));
            fetching = false;
          });
      }
    }
  };

  const scrollUp = (scrollRatio) => {
    if (scrollRatio < (1 - treshold)) {
      const toPrepend = Math.floor(windowSize * (1 - treshold));
      const {shift, slice:nodes} = sw.slide(-toPrepend);
      if (shift !== 0) {
        containerInterface.prepend(...nodes.slice(0, -shift).reverse().map(n => n.dom()));
      }
      const position = sw.position();
      if (position < bufferRefresh && fetching === false) {
        const headIndex = sw.head()[indexKey];
        const startIndex = Math.max(0, headIndex - bufferRefreshSize);
        if (startIndex !== headIndex) {
          fetching = true;
          sourceStream.pull(startIndex, bufferRefreshSize)
            .then(items => {
              sw.unshift(...items.map((item) => Object.assign(item, rowFactory(item))));
              fetching = false;
            });
        }
      }
    }
  };


  container.addEventListener('scroll', () => {
      const {scrollHeight, scrollTop, offsetHeight} = container;
      const scrollRatio = (scrollTop + offsetHeight) / scrollHeight;

      if (anteLastScroll) {
        const previousDirection = (lastScroll - anteLastScroll) > 0 ? 'down' : 'up';
        const direction = scrollTop - lastScroll > 0 ? 'down' : 'up';
        const isDirectionConfirmed = previousDirection === direction;

        if (isDirectionConfirmed) {
          if (direction === 'down') {
            scrollDown(scrollRatio);
          } else {
            scrollUp(scrollRatio);
          }
        }
      }
      anteLastScroll = lastScroll;
      lastScroll = scrollTop;
    }
  );

  table.onDisplayChange(items => {
    containerInterface.empty();
    sourceStream = dataSource({table});

    sw = slidingWindow({bufferSize, windowSize, indexKey});
    sw.push(...items.map(rowFactory));

    const {slice:initialNodes} = sw.slide(0);
    containerInterface.append(...initialNodes.map(n => n.dom()));

    //start to fill the buffer
    sourceStream.pull(sw.length, bufferSize - sw.length)
      .then(items => {
        sw.push(...items.map(rowFactory));
        if (containerInterface.length < windowSize) {
          containerInterface.empty();
          const {slice:nodes} = sw.slide(0);
          containerInterface.append(...nodes.map(n => n.dom()));
        }
      });
  });
};

function rowFactory (item) {
  const {index, value} = item;
  const li = document.createElement('LI');
  li.innerHTML = `id: ${value.id}; index ${index}`;
  return {
    dom(){
      return li;
    },
    clean(){
    }
  }
}

const data = [];

for (let i = 1; i <= 10000; i++) {
  data.push({id: i});
}

const t = table$1({
  data,
  tableState: {sort: {}, filter: {}, slice: {page: 1, size: 50}}
});

const container = document.getElementById('container');

virtualizer({
  table: t,
  rowFactory,
  container,
  // bufferSize: 800,
  // windowSize: 150,
  // indexKey: 'index',
  // treshold: 0.8
});

t.exec();

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zb3J0L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWZpbHRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zZWFyY2gvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZXZlbnRzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2V2ZW50cy5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLW9wZXJhdG9ycy9pbmRleC5qcyIsIi4uL2xpYi9oZWxwZXIuanMiLCIuLi9saWIvZGF0YVNvdXJjZS5qcyIsIi4uL2xpYi9zbGlkaW5nV2luZG93LmpzIiwiLi4vbGliL2NvbnRhaW5lci5qcyIsIi4uL2luZGV4QmlzLmpzIiwiaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIHN3YXAgKGYpIHtcbiAgcmV0dXJuIChhLCBiKSA9PiBmKGIsIGEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcG9zZSAoZmlyc3QsIC4uLmZucykge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZucy5yZWR1Y2UoKHByZXZpb3VzLCBjdXJyZW50KSA9PiBjdXJyZW50KHByZXZpb3VzKSwgZmlyc3QoLi4uYXJncykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VycnkgKGZuLCBhcml0eUxlZnQpIHtcbiAgY29uc3QgYXJpdHkgPSBhcml0eUxlZnQgfHwgZm4ubGVuZ3RoO1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCBhcmdMZW5ndGggPSBhcmdzLmxlbmd0aCB8fCAxO1xuICAgIGlmIChhcml0eSA9PT0gYXJnTGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZm4oLi4uYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGZ1bmMgPSAoLi4ubW9yZUFyZ3MpID0+IGZuKC4uLmFyZ3MsIC4uLm1vcmVBcmdzKTtcbiAgICAgIHJldHVybiBjdXJyeShmdW5jLCBhcml0eSAtIGFyZ3MubGVuZ3RoKTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseSAoZm4pIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRhcCAoZm4pIHtcbiAgcmV0dXJuIGFyZyA9PiB7XG4gICAgZm4oYXJnKTtcbiAgICByZXR1cm4gYXJnO1xuICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcG9pbnRlciAocGF0aCkge1xuXG4gIGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xuXG4gIGZ1bmN0aW9uIHBhcnRpYWwgKG9iaiA9IHt9LCBwYXJ0cyA9IFtdKSB7XG4gICAgY29uc3QgcCA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgY29uc3QgY3VycmVudCA9IG9ialtwXTtcbiAgICByZXR1cm4gKGN1cnJlbnQgPT09IHVuZGVmaW5lZCB8fCBwYXJ0cy5sZW5ndGggPT09IDApID9cbiAgICAgIGN1cnJlbnQgOiBwYXJ0aWFsKGN1cnJlbnQsIHBhcnRzKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldCAodGFyZ2V0LCBuZXdUcmVlKSB7XG4gICAgbGV0IGN1cnJlbnQgPSB0YXJnZXQ7XG4gICAgY29uc3QgW2xlYWYsIC4uLmludGVybWVkaWF0ZV0gPSBwYXJ0cy5yZXZlcnNlKCk7XG4gICAgZm9yIChsZXQga2V5IG9mIGludGVybWVkaWF0ZS5yZXZlcnNlKCkpIHtcbiAgICAgIGlmIChjdXJyZW50W2tleV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjdXJyZW50W2tleV0gPSB7fTtcbiAgICAgICAgY3VycmVudCA9IGN1cnJlbnRba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgY3VycmVudFtsZWFmXSA9IE9iamVjdC5hc3NpZ24oY3VycmVudFtsZWFmXSB8fCB7fSwgbmV3VHJlZSk7XG4gICAgcmV0dXJuIHRhcmdldDtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZ2V0KHRhcmdldCl7XG4gICAgICByZXR1cm4gcGFydGlhbCh0YXJnZXQsIFsuLi5wYXJ0c10pXG4gICAgfSxcbiAgICBzZXRcbiAgfVxufTtcbiIsImltcG9ydCB7c3dhcH0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cblxuZnVuY3Rpb24gc29ydEJ5UHJvcGVydHkgKHByb3ApIHtcbiAgY29uc3QgcHJvcEdldHRlciA9IHBvaW50ZXIocHJvcCkuZ2V0O1xuICByZXR1cm4gKGEsIGIpID0+IHtcbiAgICBjb25zdCBhVmFsID0gcHJvcEdldHRlcihhKTtcbiAgICBjb25zdCBiVmFsID0gcHJvcEdldHRlcihiKTtcblxuICAgIGlmIChhVmFsID09PSBiVmFsKSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBpZiAoYlZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuXG4gICAgaWYgKGFWYWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIDE7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFWYWwgPCBiVmFsID8gLTEgOiAxO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNvcnRGYWN0b3J5ICh7cG9pbnRlciwgZGlyZWN0aW9ufSA9IHt9KSB7XG4gIGlmICghcG9pbnRlciB8fCBkaXJlY3Rpb24gPT09ICdub25lJykge1xuICAgIHJldHVybiBhcnJheSA9PiBbLi4uYXJyYXldO1xuICB9XG5cbiAgY29uc3Qgb3JkZXJGdW5jID0gc29ydEJ5UHJvcGVydHkocG9pbnRlcik7XG4gIGNvbnN0IGNvbXBhcmVGdW5jID0gZGlyZWN0aW9uID09PSAnZGVzYycgPyBzd2FwKG9yZGVyRnVuYykgOiBvcmRlckZ1bmM7XG5cbiAgcmV0dXJuIChhcnJheSkgPT4gWy4uLmFycmF5XS5zb3J0KGNvbXBhcmVGdW5jKTtcbn0iLCJpbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5mdW5jdGlvbiB0eXBlRXhwcmVzc2lvbiAodHlwZSkge1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiBCb29sZWFuO1xuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gTnVtYmVyO1xuICAgIGNhc2UgJ2RhdGUnOlxuICAgICAgcmV0dXJuICh2YWwpID0+IG5ldyBEYXRlKHZhbCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBjb21wb3NlKFN0cmluZywgKHZhbCkgPT4gdmFsLnRvTG93ZXJDYXNlKCkpO1xuICB9XG59XG5cbmNvbnN0IG9wZXJhdG9ycyA9IHtcbiAgaW5jbHVkZXModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0LmluY2x1ZGVzKHZhbHVlKTtcbiAgfSxcbiAgaXModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IE9iamVjdC5pcyh2YWx1ZSwgaW5wdXQpO1xuICB9LFxuICBpc05vdCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gIU9iamVjdC5pcyh2YWx1ZSwgaW5wdXQpO1xuICB9LFxuICBsdCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPCB2YWx1ZTtcbiAgfSxcbiAgZ3QodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0ID4gdmFsdWU7XG4gIH0sXG4gIGx0ZSh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPD0gdmFsdWU7XG4gIH0sXG4gIGd0ZSh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPj0gdmFsdWU7XG4gIH0sXG4gIGVxdWFscyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gdmFsdWUgPT0gaW5wdXQ7XG4gIH0sXG4gIG5vdEVxdWFscyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gdmFsdWUgIT0gaW5wdXQ7XG4gIH1cbn07XG5cbmNvbnN0IGV2ZXJ5ID0gZm5zID0+ICguLi5hcmdzKSA9PiBmbnMuZXZlcnkoZm4gPT4gZm4oLi4uYXJncykpO1xuXG5leHBvcnQgZnVuY3Rpb24gcHJlZGljYXRlICh7dmFsdWUgPSAnJywgb3BlcmF0b3IgPSAnaW5jbHVkZXMnLCB0eXBlID0gJ3N0cmluZyd9KSB7XG4gIGNvbnN0IHR5cGVJdCA9IHR5cGVFeHByZXNzaW9uKHR5cGUpO1xuICBjb25zdCBvcGVyYXRlT25UeXBlZCA9IGNvbXBvc2UodHlwZUl0LCBvcGVyYXRvcnNbb3BlcmF0b3JdKTtcbiAgY29uc3QgcHJlZGljYXRlRnVuYyA9IG9wZXJhdGVPblR5cGVkKHZhbHVlKTtcbiAgcmV0dXJuIGNvbXBvc2UodHlwZUl0LCBwcmVkaWNhdGVGdW5jKTtcbn1cblxuLy9hdm9pZCB1c2VsZXNzIGZpbHRlciBsb29rdXAgKGltcHJvdmUgcGVyZilcbmZ1bmN0aW9uIG5vcm1hbGl6ZUNsYXVzZXMgKGNvbmYpIHtcbiAgY29uc3Qgb3V0cHV0ID0ge307XG4gIGNvbnN0IHZhbGlkUGF0aCA9IE9iamVjdC5rZXlzKGNvbmYpLmZpbHRlcihwYXRoID0+IEFycmF5LmlzQXJyYXkoY29uZltwYXRoXSkpO1xuICB2YWxpZFBhdGguZm9yRWFjaChwYXRoID0+IHtcbiAgICBjb25zdCB2YWxpZENsYXVzZXMgPSBjb25mW3BhdGhdLmZpbHRlcihjID0+IGMudmFsdWUgIT09ICcnKTtcbiAgICBpZiAodmFsaWRDbGF1c2VzLmxlbmd0aCkge1xuICAgICAgb3V0cHV0W3BhdGhdID0gdmFsaWRDbGF1c2VzO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGZpbHRlciAoZmlsdGVyKSB7XG4gIGNvbnN0IG5vcm1hbGl6ZWRDbGF1c2VzID0gbm9ybWFsaXplQ2xhdXNlcyhmaWx0ZXIpO1xuICBjb25zdCBmdW5jTGlzdCA9IE9iamVjdC5rZXlzKG5vcm1hbGl6ZWRDbGF1c2VzKS5tYXAocGF0aCA9PiB7XG4gICAgY29uc3QgZ2V0dGVyID0gcG9pbnRlcihwYXRoKS5nZXQ7XG4gICAgY29uc3QgY2xhdXNlcyA9IG5vcm1hbGl6ZWRDbGF1c2VzW3BhdGhdLm1hcChwcmVkaWNhdGUpO1xuICAgIHJldHVybiBjb21wb3NlKGdldHRlciwgZXZlcnkoY2xhdXNlcykpO1xuICB9KTtcbiAgY29uc3QgZmlsdGVyUHJlZGljYXRlID0gZXZlcnkoZnVuY0xpc3QpO1xuXG4gIHJldHVybiAoYXJyYXkpID0+IGFycmF5LmZpbHRlcihmaWx0ZXJQcmVkaWNhdGUpO1xufSIsImltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChzZWFyY2hDb25mID0ge30pIHtcbiAgY29uc3Qge3ZhbHVlLCBzY29wZSA9IFtdfSA9IHNlYXJjaENvbmY7XG4gIGNvbnN0IHNlYXJjaFBvaW50ZXJzID0gc2NvcGUubWFwKGZpZWxkID0+IHBvaW50ZXIoZmllbGQpLmdldCk7XG4gIGlmICghc2NvcGUubGVuZ3RoIHx8ICF2YWx1ZSkge1xuICAgIHJldHVybiBhcnJheSA9PiBhcnJheTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gYXJyYXkuZmlsdGVyKGl0ZW0gPT4gc2VhcmNoUG9pbnRlcnMuc29tZShwID0+IFN0cmluZyhwKGl0ZW0pKS5pbmNsdWRlcyhTdHJpbmcodmFsdWUpKSkpXG4gIH1cbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzbGljZUZhY3RvcnkgKHtwYWdlID0gMSwgc2l6ZX0gPSB7fSkge1xuICByZXR1cm4gZnVuY3Rpb24gc2xpY2VGdW5jdGlvbiAoYXJyYXkgPSBbXSkge1xuICAgIGNvbnN0IGFjdHVhbFNpemUgPSBzaXplIHx8IGFycmF5Lmxlbmd0aDtcbiAgICBjb25zdCBvZmZzZXQgPSAocGFnZSAtIDEpICogYWN0dWFsU2l6ZTtcbiAgICByZXR1cm4gYXJyYXkuc2xpY2Uob2Zmc2V0LCBvZmZzZXQgKyBhY3R1YWxTaXplKTtcbiAgfTtcbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBlbWl0dGVyICgpIHtcblxuICBjb25zdCBsaXN0ZW5lcnNMaXN0cyA9IHt9O1xuXG4gIHJldHVybiB7XG4gICAgb24oZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSAobGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdKS5jb25jYXQobGlzdGVuZXJzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgZGlzcGF0Y2goZXZlbnQsIC4uLmFyZ3Mpe1xuICAgICAgY29uc3QgbGlzdGVuZXJzID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgZm9yIChsZXQgbGlzdGVuZXIgb2YgbGlzdGVuZXJzKSB7XG4gICAgICAgIGxpc3RlbmVyKC4uLmFyZ3MpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBvZmYoZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGxpc3RlbmVyc0xpc3RzKS5mb3JFYWNoKGV2ID0+IHRoaXMub2ZmKGV2KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBsaXN0ID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSBsaXN0ZW5lcnMubGVuZ3RoID8gbGlzdC5maWx0ZXIobGlzdGVuZXIgPT4gIWxpc3RlbmVycy5pbmNsdWRlcyhsaXN0ZW5lcikpIDogW107XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb3h5TGlzdGVuZXIgKGV2ZW50TWFwKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoe2VtaXR0ZXJ9KSB7XG5cbiAgICBjb25zdCBwcm94eSA9IHt9O1xuICAgIGxldCBldmVudExpc3RlbmVycyA9IHt9O1xuXG4gICAgZm9yIChsZXQgZXYgb2YgT2JqZWN0LmtleXMoZXZlbnRNYXApKSB7XG4gICAgICBjb25zdCBtZXRob2QgPSBldmVudE1hcFtldl07XG4gICAgICBldmVudExpc3RlbmVyc1tldl0gPSBbXTtcbiAgICAgIHByb3h5W21ldGhvZF0gPSBmdW5jdGlvbiAoLi4ubGlzdGVuZXJzKSB7XG4gICAgICAgIGV2ZW50TGlzdGVuZXJzW2V2XSA9IGV2ZW50TGlzdGVuZXJzW2V2XS5jb25jYXQobGlzdGVuZXJzKTtcbiAgICAgICAgZW1pdHRlci5vbihldiwgLi4ubGlzdGVuZXJzKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHByb3h5LCB7XG4gICAgICBvZmYoZXYpe1xuICAgICAgICBpZiAoIWV2KSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMoZXZlbnRMaXN0ZW5lcnMpLmZvckVhY2goZXZlbnROYW1lID0+IHRoaXMub2ZmKGV2ZW50TmFtZSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50TGlzdGVuZXJzW2V2XSkge1xuICAgICAgICAgIGVtaXR0ZXIub2ZmKGV2LCAuLi5ldmVudExpc3RlbmVyc1tldl0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0iLCJleHBvcnQgY29uc3QgVE9HR0xFX1NPUlQgPSAnVE9HR0xFX1NPUlQnO1xuZXhwb3J0IGNvbnN0IERJU1BMQVlfQ0hBTkdFRCA9ICdESVNQTEFZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFBBR0VfQ0hBTkdFRCA9ICdDSEFOR0VfUEFHRSc7XG5leHBvcnQgY29uc3QgRVhFQ19DSEFOR0VEID0gJ0VYRUNfU1RBUlRFRCc7XG5leHBvcnQgY29uc3QgRklMVEVSX0NIQU5HRUQgPSAnRklMVEVSX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNVTU1BUllfQ0hBTkdFRCA9ICdTVU1NQVJZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNFQVJDSF9DSEFOR0VEID0gJ1NFQVJDSF9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBFWEVDX0VSUk9SID0gJ0VYRUNfRVJST1InOyIsImltcG9ydCBzbGljZSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge2N1cnJ5LCB0YXAsIGNvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuaW1wb3J0IHtlbWl0dGVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuaW1wb3J0IHNsaWNlRmFjdG9yeSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge1xuICBTVU1NQVJZX0NIQU5HRUQsXG4gIFRPR0dMRV9TT1JULFxuICBESVNQTEFZX0NIQU5HRUQsXG4gIFBBR0VfQ0hBTkdFRCxcbiAgRVhFQ19DSEFOR0VELFxuICBGSUxURVJfQ0hBTkdFRCxcbiAgU0VBUkNIX0NIQU5HRUQsXG4gIEVYRUNfRVJST1Jcbn0gZnJvbSAnLi4vZXZlbnRzJztcblxuZnVuY3Rpb24gY3VycmllZFBvaW50ZXIgKHBhdGgpIHtcbiAgY29uc3Qge2dldCwgc2V0fSA9IHBvaW50ZXIocGF0aCk7XG4gIHJldHVybiB7Z2V0LCBzZXQ6IGN1cnJ5KHNldCl9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSxcbiAgdGFibGVTdGF0ZSxcbiAgZGF0YSxcbiAgZmlsdGVyRmFjdG9yeSxcbiAgc2VhcmNoRmFjdG9yeVxufSkge1xuICBjb25zdCB0YWJsZSA9IGVtaXR0ZXIoKTtcbiAgY29uc3Qgc29ydFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc29ydCcpO1xuICBjb25zdCBzbGljZVBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2xpY2UnKTtcbiAgY29uc3QgZmlsdGVyUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdmaWx0ZXInKTtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzZWFyY2gnKTtcblxuICBjb25zdCBzYWZlQXNzaWduID0gY3VycnkoKGJhc2UsIGV4dGVuc2lvbikgPT4gT2JqZWN0LmFzc2lnbih7fSwgYmFzZSwgZXh0ZW5zaW9uKSk7XG4gIGNvbnN0IGRpc3BhdGNoID0gY3VycnkodGFibGUuZGlzcGF0Y2guYmluZCh0YWJsZSksIDIpO1xuXG4gIGNvbnN0IGNyZWF0ZVN1bW1hcnkgPSAoZmlsdGVyZWQpID0+IHtcbiAgICBkaXNwYXRjaChTVU1NQVJZX0NIQU5HRUQsIHtcbiAgICAgIHBhZ2U6IHRhYmxlU3RhdGUuc2xpY2UucGFnZSxcbiAgICAgIHNpemU6IHRhYmxlU3RhdGUuc2xpY2Uuc2l6ZSxcbiAgICAgIGZpbHRlcmVkQ291bnQ6IGZpbHRlcmVkLmxlbmd0aFxuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IGV4ZWMgPSAoe3Byb2Nlc3NpbmdEZWxheSA9IDIwfSA9IHt9KSA9PiB7XG4gICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogdHJ1ZX0pO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNvcnRGdW5jID0gc29ydEZhY3Rvcnkoc29ydFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgdGFwKGNyZWF0ZVN1bW1hcnkpLCBzb3J0RnVuYywgc2xpY2VGdW5jKTtcbiAgICAgICAgY29uc3QgZGlzcGxheWVkID0gZXhlY0Z1bmMoZGF0YSk7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKERJU1BMQVlfQ0hBTkdFRCwgZGlzcGxheWVkLm1hcChkID0+IHtcbiAgICAgICAgICByZXR1cm4ge2luZGV4OiBkYXRhLmluZGV4T2YoZCksIHZhbHVlOiBkfTtcbiAgICAgICAgfSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0VSUk9SLCBlKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfQ0hBTkdFRCwge3dvcmtpbmc6IGZhbHNlfSk7XG4gICAgICB9XG4gICAgfSwgcHJvY2Vzc2luZ0RlbGF5KTtcbiAgfTtcblxuICBjb25zdCB1cGRhdGVUYWJsZVN0YXRlID0gY3VycnkoKHB0ZXIsIGV2LCBuZXdQYXJ0aWFsU3RhdGUpID0+IGNvbXBvc2UoXG4gICAgc2FmZUFzc2lnbihwdGVyLmdldCh0YWJsZVN0YXRlKSksXG4gICAgdGFwKGRpc3BhdGNoKGV2KSksXG4gICAgcHRlci5zZXQodGFibGVTdGF0ZSlcbiAgKShuZXdQYXJ0aWFsU3RhdGUpKTtcblxuICBjb25zdCByZXNldFRvRmlyc3RQYWdlID0gKCkgPT4gdXBkYXRlVGFibGVTdGF0ZShzbGljZVBvaW50ZXIsIFBBR0VfQ0hBTkdFRCwge3BhZ2U6IDF9KTtcblxuICBjb25zdCB0YWJsZU9wZXJhdGlvbiA9IChwdGVyLCBldikgPT4gY29tcG9zZShcbiAgICB1cGRhdGVUYWJsZVN0YXRlKHB0ZXIsIGV2KSxcbiAgICByZXNldFRvRmlyc3RQYWdlLFxuICAgICgpID0+IHRhYmxlLmV4ZWMoKSAvLyB3ZSB3cmFwIHdpdGhpbiBhIGZ1bmN0aW9uIHNvIHRhYmxlLmV4ZWMgY2FuIGJlIG92ZXJ3cml0dGVuICh3aGVuIHVzaW5nIHdpdGggYSBzZXJ2ZXIgZm9yIGV4YW1wbGUpXG4gICk7XG5cbiAgY29uc3QgYXBpID0ge1xuICAgIHNvcnQ6IHRhYmxlT3BlcmF0aW9uKHNvcnRQb2ludGVyLCBUT0dHTEVfU09SVCksXG4gICAgZmlsdGVyOiB0YWJsZU9wZXJhdGlvbihmaWx0ZXJQb2ludGVyLCBGSUxURVJfQ0hBTkdFRCksXG4gICAgc2VhcmNoOiB0YWJsZU9wZXJhdGlvbihzZWFyY2hQb2ludGVyLCBTRUFSQ0hfQ0hBTkdFRCksXG4gICAgc2xpY2U6IGNvbXBvc2UodXBkYXRlVGFibGVTdGF0ZShzbGljZVBvaW50ZXIsIFBBR0VfQ0hBTkdFRCksICgpID0+IHRhYmxlLmV4ZWMoKSksXG4gICAgZXhlYyxcbiAgICBldmFsKHN0YXRlID0gdGFibGVTdGF0ZSl7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGNvbnN0IHNvcnRGdW5jID0gc29ydEZhY3Rvcnkoc29ydFBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3Qgc2VhcmNoRnVuYyA9IHNlYXJjaEZhY3Rvcnkoc2VhcmNoUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBmaWx0ZXJGdW5jID0gZmlsdGVyRmFjdG9yeShmaWx0ZXJQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IHNsaWNlRnVuYyA9IHNsaWNlRmFjdG9yeShzbGljZVBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3QgZXhlY0Z1bmMgPSBjb21wb3NlKGZpbHRlckZ1bmMsIHNlYXJjaEZ1bmMsIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICAgIHJldHVybiBleGVjRnVuYyhkYXRhKS5tYXAoZCA9PiB7XG4gICAgICAgICAgICByZXR1cm4ge2luZGV4OiBkYXRhLmluZGV4T2YoZCksIHZhbHVlOiBkfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIG9uRGlzcGxheUNoYW5nZShmbil7XG4gICAgICB0YWJsZS5vbihESVNQTEFZX0NIQU5HRUQsIGZuKTtcbiAgICB9LFxuICAgIGdldFRhYmxlU3RhdGUoKXtcbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlKVxuICAgIH1cbiAgfTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbih0YWJsZSwgYXBpKTtcbn0iLCJpbXBvcnQgc29ydCBmcm9tICdzbWFydC10YWJsZS1zb3J0JztcbmltcG9ydCBmaWx0ZXIgZnJvbSAnc21hcnQtdGFibGUtZmlsdGVyJztcbmltcG9ydCBzZWFyY2ggZnJvbSAnc21hcnQtdGFibGUtc2VhcmNoJztcbmltcG9ydCB0YWJsZSBmcm9tICcuL2RpcmVjdGl2ZXMvdGFibGUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSA9IHNvcnQsXG4gIGZpbHRlckZhY3RvcnkgPSBmaWx0ZXIsXG4gIHNlYXJjaEZhY3RvcnkgPSBzZWFyY2gsXG4gIHRhYmxlU3RhdGUgPSB7c29ydDoge30sIHNsaWNlOiB7cGFnZTogMX0sIGZpbHRlcjoge30sIHNlYXJjaDoge319LFxuICBkYXRhID0gW11cbn0sIC4uLnRhYmxlRGlyZWN0aXZlcykge1xuXG4gIGNvbnN0IGNvcmVUYWJsZSA9IHRhYmxlKHtzb3J0RmFjdG9yeSwgZmlsdGVyRmFjdG9yeSwgdGFibGVTdGF0ZSwgZGF0YSwgc2VhcmNoRmFjdG9yeX0pO1xuXG4gIHJldHVybiB0YWJsZURpcmVjdGl2ZXMucmVkdWNlKChhY2N1bXVsYXRvciwgbmV3ZGlyKSA9PiB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oYWNjdW11bGF0b3IsIG5ld2Rpcih7XG4gICAgICBzb3J0RmFjdG9yeSxcbiAgICAgIGZpbHRlckZhY3RvcnksXG4gICAgICBzZWFyY2hGYWN0b3J5LFxuICAgICAgdGFibGVTdGF0ZSxcbiAgICAgIGRhdGEsXG4gICAgICB0YWJsZTogY29yZVRhYmxlXG4gICAgfSkpO1xuICB9LCBjb3JlVGFibGUpO1xufSIsImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImltcG9ydCB7Y3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmV4cG9ydCBmdW5jdGlvbiogZ2l2ZU1lTiAobikge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG47IGkrKykge1xuICAgIHlpZWxkIGk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGRvTlRpbWVzID0gY3VycnkoKGZuLCBjb3VudCA9IDEpID0+IHtcbiAgY29uc3QgbiA9IGNvdW50IHx8IDE7XG4gIFsuLi5naXZlTWVOKG4pXS5mb3JFYWNoKCgpID0+IGZuKCkpO1xufSwgMik7XG4iLCJpbXBvcnQge2dpdmVNZU59IGZyb20gJy4vaGVscGVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHt0YWJsZX0pIHtcbiAgcmV0dXJuIHtcbiAgICBwdWxsKG9mZnNldCwgbnVtYmVyKXtcbiAgICAgIGNvbnN0IHRhYmxlU3RhdGUgPSB0YWJsZS5nZXRUYWJsZVN0YXRlKCk7XG4gICAgICBjb25zdCB7c2xpY2U6e3NpemU6cGFnZVNpemV9fSA9IHRhYmxlU3RhdGU7XG4gICAgICBjb25zdCBzdGFydFBhZ2UgPSBNYXRoLmZsb29yKG9mZnNldCAvIHBhZ2VTaXplKTtcbiAgICAgIGNvbnN0IHRyaW1CZWZvcmUgPSBvZmZzZXQgJSBwYWdlU2l6ZTtcbiAgICAgIGNvbnN0IGxhc3RQYWdlID0gTWF0aC5jZWlsKChvZmZzZXQgKyBudW1iZXIpIC8gcGFnZVNpemUpO1xuICAgICAgY29uc3QgcGFnZUNvbmZMaXN0ID0gWy4uLmdpdmVNZU4obGFzdFBhZ2UgLSBzdGFydFBhZ2UpXS5tYXAob2ZmID0+ICh7XG4gICAgICAgIHBhZ2U6IHN0YXJ0UGFnZSArIG9mZiArIDEsXG4gICAgICAgIHNpemU6IHBhZ2VTaXplXG4gICAgICB9KSk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5hbGwocGFnZUNvbmZMaXN0Lm1hcChzbGljZSA9PiB7XG4gICAgICAgIHJldHVybiB0YWJsZS5ldmFsKE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUsIHtzbGljZX0pKTtcbiAgICAgIH0sIFtdKSlcbiAgICAgICAgLnRoZW4ocGFnZXMgPT4ge1xuICAgICAgICAgIHJldHVybiBwYWdlcy5yZWR1Y2UoKGFjYywgY3VycikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFjYy5jb25jYXQoY3Vycik7XG4gICAgICAgICAgfSwgW10pXG4gICAgICAgICAgICAuZmlsdGVyKChpdGVtLCBpbmRleCkgPT4gaW5kZXggPj0gdHJpbUJlZm9yZSlcbiAgICAgICAgICAgIC5zbGljZSgwLCBudW1iZXIpO1xuICAgICAgICB9KTtcbiAgICB9XG4gIH07XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtidWZmZXJTaXplID0gMTAwMCwgd2luZG93U2l6ZSA9IDIwMCwgaW5kZXhLZXkgPSAnJCRpbmRleCd9ID0ge30pIHtcblxuICBjb25zdCBkYXRhTGlzdCA9IFtdO1xuICBsZXQgd2luZG93Q3Vyc29yID0gbnVsbDtcblxuICBjb25zdCBpbnN0YW5jZSA9IHtcbiAgICBwdXNoKCl7XG4gICAgICBjb25zdCBpdGVtcyA9IFsuLi5hcmd1bWVudHNdO1xuICAgICAgY29uc3QgbWF4UmVtb3ZhYmxlSXRlbUNvdW50ID0gTWF0aC5taW4oZGF0YUxpc3QuaW5kZXhPZih3aW5kb3dDdXJzb3IpLCBpdGVtcy5sZW5ndGgpO1xuICAgICAgY29uc3QgbGltaXQgPSBkYXRhTGlzdC5sZW5ndGggPCBidWZmZXJTaXplID8gYnVmZmVyU2l6ZSAtIGRhdGFMaXN0Lmxlbmd0aCA6IG1heFJlbW92YWJsZUl0ZW1Db3VudDtcbiAgICAgIGNvbnN0IHRvQXBwZW5kID0gaXRlbXMuc2xpY2UoMCwgbGltaXQpO1xuICAgICAgY29uc3QgdGFpbEl0ZW0gPSBpbnN0YW5jZS50YWlsKCk7XG4gICAgICBjb25zdCBzdGFydEluZGV4ID0gdGFpbEl0ZW0gPyB0YWlsSXRlbVtpbmRleEtleV0gKyAxIDogMDtcbiAgICAgIGRhdGFMaXN0LnB1c2goLi4udG9BcHBlbmQubWFwKChpdGVtLCBvZmZzZXQpID0+IE9iamVjdC5hc3NpZ24oe1tpbmRleEtleV06IHN0YXJ0SW5kZXggKyBvZmZzZXR9LCBpdGVtKSkpO1xuICAgICAgaWYgKGRhdGFMaXN0Lmxlbmd0aCA+IGJ1ZmZlclNpemUpIHtcbiAgICAgICAgY29uc3QgdG9Ecm9wID0gZGF0YUxpc3Quc3BsaWNlKDAsIGxpbWl0KTtcbiAgICAgICAgdG9Ecm9wLmZvckVhY2goaXRlbSA9PiB7XG4gICAgICAgICAgaWYgKGl0ZW0uY2xlYW4pIHtcbiAgICAgICAgICAgIGl0ZW0uY2xlYW4oKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgdW5zaGlmdCgpe1xuICAgICAgY29uc3QgaXRlbXMgPSBbLi4uYXJndW1lbnRzXTtcbiAgICAgIGNvbnN0IHVwcGVyV2luZG93SW5kZXggPSAoZGF0YUxpc3QuaW5kZXhPZih3aW5kb3dDdXJzb3IpICsgd2luZG93U2l6ZSk7XG4gICAgICBjb25zdCBtYXhSZW1vdmFibGVJdGVtQ291bnQgPSBNYXRoLm1pbihkYXRhTGlzdC5sZW5ndGggLSB1cHBlcldpbmRvd0luZGV4LCBpdGVtcy5sZW5ndGgpO1xuICAgICAgY29uc3QgbGltaXQgPSBkYXRhTGlzdC5sZW5ndGggPCBidWZmZXJTaXplID8gYnVmZmVyU2l6ZSAtIGRhdGFMaXN0Lmxlbmd0aCA6IG1heFJlbW92YWJsZUl0ZW1Db3VudDtcbiAgICAgIGNvbnN0IHRvUHJlcGVuZCA9IGl0ZW1zLnNsaWNlKDAsIGxpbWl0KTtcbiAgICAgIGNvbnN0IHN0YXJ0SW5kZXggPSBpbnN0YW5jZS5oZWFkKClbaW5kZXhLZXldIC0gbGltaXQ7XG4gICAgICBkYXRhTGlzdC51bnNoaWZ0KC4uLnRvUHJlcGVuZC5tYXAoKGl0ZW0sIG9mZnNldCkgPT4gT2JqZWN0LmFzc2lnbih7W2luZGV4S2V5XTogc3RhcnRJbmRleCArIG9mZnNldH0sIGl0ZW0pKSk7XG4gICAgICBpZiAoZGF0YUxpc3QubGVuZ3RoID4gYnVmZmVyU2l6ZSkge1xuICAgICAgICBjb25zdCB0b0Ryb3AgPSBkYXRhTGlzdC5zcGxpY2UoLWxpbWl0KTtcbiAgICAgICAgdG9Ecm9wLmZvckVhY2goaXRlbSA9PiB7XG4gICAgICAgICAgaWYgKGl0ZW0uY2xlYW4pIHtcbiAgICAgICAgICAgIGl0ZW0uY2xlYW4oKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgZ2V0KGluZGV4KXtcbiAgICAgIHJldHVybiBkYXRhTGlzdC5maW5kKGl0ZW0gPT4gaXRlbVtpbmRleEtleV0gPT09IGluZGV4KTtcbiAgICB9LFxuICAgIGhlYWQoKXtcbiAgICAgIHJldHVybiBkYXRhTGlzdFswXSB8fCBudWxsO1xuICAgIH0sXG4gICAgdGFpbCgpe1xuICAgICAgcmV0dXJuIGRhdGFMaXN0Lmxlbmd0aCA/IGRhdGFMaXN0W2RhdGFMaXN0Lmxlbmd0aCAtIDFdIDogbnVsbDtcbiAgICB9LFxuICAgIHNsaWRlKG9mZnNldCl7XG4gICAgICBjb25zdCBjdXJzb3JJbmRleCA9IGRhdGFMaXN0LmluZGV4T2Yod2luZG93Q3Vyc29yKSB8fCAwO1xuICAgICAgY29uc3QgaW5kZXggPSBNYXRoLm1heChjdXJzb3JJbmRleCArIG9mZnNldCwgMCk7XG4gICAgICBjb25zdCBzdGFydCA9IGluZGV4ICsgd2luZG93U2l6ZSA+PSAoYnVmZmVyU2l6ZSAtIDEpID8gYnVmZmVyU2l6ZSAtIHdpbmRvd1NpemUgOiBpbmRleDtcbiAgICAgIGNvbnN0IHNsaWNlID0gZGF0YUxpc3Quc2xpY2Uoc3RhcnQsIHN0YXJ0ICsgd2luZG93U2l6ZSk7XG4gICAgICBjb25zdCBzaGlmdCA9IHN0YXJ0IC0gY3Vyc29ySW5kZXg7XG4gICAgICB3aW5kb3dDdXJzb3IgPSBkYXRhTGlzdFtzdGFydF07XG4gICAgICByZXR1cm4ge3NsaWNlLCBzaGlmdH07XG4gICAgfSxcbiAgICBwb3NpdGlvbigpe1xuICAgICAgcmV0dXJuIChkYXRhTGlzdC5pbmRleE9mKHdpbmRvd0N1cnNvcikgKyAxKSAvIChidWZmZXJTaXplIC0gd2luZG93U2l6ZSk7XG4gICAgfVxuICB9O1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpbnN0YW5jZSwgJ2xlbmd0aCcsIHtcbiAgICBnZXQoKXtcbiAgICAgIHJldHVybiBkYXRhTGlzdC5sZW5ndGg7XG4gICAgfVxuICB9KTtcblxuXG4gIHJldHVybiBpbnN0YW5jZTtcblxuXG59IiwiaW1wb3J0IHtkb05UaW1lc30gZnJvbSAnLi9oZWxwZXInXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7ZWxlbWVudCwgd2luZG93U2l6ZX0pIHtcblxuICBjb25zdCBpbnN0YW5jZSA9IHtcbiAgICBhcHBlbmQoLi4uYXJncyl7XG4gICAgICBmb3IgKGxldCBpdGVtIG9mIGFyZ3MpIHtcbiAgICAgICAgZWxlbWVudC5hcHBlbmRDaGlsZChpdGVtKTtcbiAgICAgICAgaWYgKGluc3RhbmNlLmxlbmd0aCA+IHdpbmRvd1NpemUpIHtcbiAgICAgICAgICBpbnN0YW5jZS5kcm9wQmVnaW4oaW5zdGFuY2UubGVuZ3RoIC0gd2luZG93U2l6ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIHByZXBlbmQoLi4uYXJncyl7XG4gICAgICBmb3IgKGxldCBpdGVtIG9mIGFyZ3MpIHtcbiAgICAgICAgZWxlbWVudC5pbnNlcnRCZWZvcmUoaXRlbSwgZWxlbWVudC5maXJzdENoaWxkKTtcbiAgICAgICAgaWYgKGluc3RhbmNlLmxlbmd0aCA+IHdpbmRvd1NpemUpIHtcbiAgICAgICAgICBpbnN0YW5jZS5kcm9wRW5kKGluc3RhbmNlLmxlbmd0aCAtIHdpbmRvd1NpemUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBkcm9wQmVnaW46IGRvTlRpbWVzKCgpID0+IHtcbiAgICAgIGNvbnN0IGZpcnN0Q2hpbGQgPSBlbGVtZW50LmZpcnN0Q2hpbGQ7XG4gICAgICBpZiAoZmlyc3RDaGlsZCkge1xuICAgICAgICBmaXJzdENoaWxkLnJlbW92ZSgpO1xuICAgICAgfVxuICAgIH0pLFxuICAgIGRyb3BFbmQ6IGRvTlRpbWVzKCgpID0+IHtcbiAgICAgIGNvbnN0IGxhc3RDaGlsZCA9IGVsZW1lbnQubGFzdENoaWxkO1xuICAgICAgaWYgKGxhc3RDaGlsZCkge1xuICAgICAgICBsYXN0Q2hpbGQucmVtb3ZlKCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgZW1wdHkoKXtcbiAgICAgIGVsZW1lbnQuaW5uZXJIVE1MID0gJyc7XG4gICAgfVxuICB9O1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpbnN0YW5jZSwgJ2xlbmd0aCcsIHtcbiAgICBnZXQoKXtcbiAgICAgIHJldHVybiBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn0iLCJpbXBvcnQgZGF0YVNvdXJjZSBmcm9tICcuL2xpYi9kYXRhU291cmNlJztcbmltcG9ydCBzbGlkaW5nV2luZG93IGZyb20gJy4vbGliL3NsaWRpbmdXaW5kb3cnO1xuaW1wb3J0IGNvbnRhaW5lckZhY3RvcnkgZnJvbSAnLi9saWIvY29udGFpbmVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtjb250YWluZXIsIHRhYmxlLCByb3dGYWN0b3J5LCBpbmRleEtleSA9ICckJGluZGV4Jywgd2luZG93U2l6ZSA9IDIwMCwgYnVmZmVyU2l6ZSA9IDEwMDAsIHRyZXNob2xkID0gMC44fSkge1xuICBsZXQgc291cmNlU3RyZWFtID0gbnVsbDtcbiAgbGV0IHN3ID0gbnVsbDtcbiAgbGV0IGxhc3RTY3JvbGw7XG4gIGxldCBhbnRlTGFzdFNjcm9sbDtcbiAgbGV0IGZldGNoaW5nID0gZmFsc2U7XG5cbiAgY29uc3QgYnVmZmVyUmVmcmVzaCA9IDAuNTtcbiAgY29uc3QgYnVmZmVyUmVmcmVzaFNpemUgPSBidWZmZXJSZWZyZXNoICogYnVmZmVyU2l6ZSAvIDI7XG5cbiAgY29uc3QgY29udGFpbmVySW50ZXJmYWNlID0gY29udGFpbmVyRmFjdG9yeSh7ZWxlbWVudDogY29udGFpbmVyLCB3aW5kb3dTaXplfSk7XG5cbiAgY29uc3Qgc2Nyb2xsRG93biA9IChzY3JvbGxSYXRpbykgPT4ge1xuICAgIGlmIChzY3JvbGxSYXRpbyA+IHRyZXNob2xkKSB7XG4gICAgICBjb25zdCB0b0FwcGVuZCA9IE1hdGguZmxvb3Iod2luZG93U2l6ZSAqICgxIC0gc2Nyb2xsUmF0aW8pKTtcbiAgICAgIGNvbnN0IHtzaGlmdCwgc2xpY2U6bm9kZXN9ID0gc3cuc2xpZGUodG9BcHBlbmQpO1xuICAgICAgaWYgKHNoaWZ0ICE9PSAwKSB7XG4gICAgICAgIGNvbnRhaW5lckludGVyZmFjZS5hcHBlbmQoLi4ubm9kZXMuc2xpY2UoLXNoaWZ0KS5tYXAobiA9PiBuLmRvbSgpKSk7XG4gICAgICB9XG4gICAgICBjb25zdCBwb3NpdGlvbiA9IHN3LnBvc2l0aW9uKCk7XG4gICAgICBpZiAocG9zaXRpb24gPiBidWZmZXJSZWZyZXNoICYmIGZldGNoaW5nID09PSBmYWxzZSkge1xuICAgICAgICBjb25zdCB0YWlsSW5kZXggPSBzdy50YWlsKClbaW5kZXhLZXldO1xuICAgICAgICBmZXRjaGluZyA9IHRydWU7XG4gICAgICAgIHNvdXJjZVN0cmVhbS5wdWxsKHRhaWxJbmRleCArIDEsIGJ1ZmZlclJlZnJlc2hTaXplKVxuICAgICAgICAgIC50aGVuKGl0ZW1zID0+IHtcbiAgICAgICAgICAgIHN3LnB1c2goLi4uaXRlbXMubWFwKHJvd0ZhY3RvcnkpKTtcbiAgICAgICAgICAgIGZldGNoaW5nID0gZmFsc2U7XG4gICAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHNjcm9sbFVwID0gKHNjcm9sbFJhdGlvKSA9PiB7XG4gICAgaWYgKHNjcm9sbFJhdGlvIDwgKDEgLSB0cmVzaG9sZCkpIHtcbiAgICAgIGNvbnN0IHRvUHJlcGVuZCA9IE1hdGguZmxvb3Iod2luZG93U2l6ZSAqICgxIC0gdHJlc2hvbGQpKTtcbiAgICAgIGNvbnN0IHtzaGlmdCwgc2xpY2U6bm9kZXN9ID0gc3cuc2xpZGUoLXRvUHJlcGVuZCk7XG4gICAgICBpZiAoc2hpZnQgIT09IDApIHtcbiAgICAgICAgY29udGFpbmVySW50ZXJmYWNlLnByZXBlbmQoLi4ubm9kZXMuc2xpY2UoMCwgLXNoaWZ0KS5yZXZlcnNlKCkubWFwKG4gPT4gbi5kb20oKSkpO1xuICAgICAgfVxuICAgICAgY29uc3QgcG9zaXRpb24gPSBzdy5wb3NpdGlvbigpO1xuICAgICAgaWYgKHBvc2l0aW9uIDwgYnVmZmVyUmVmcmVzaCAmJiBmZXRjaGluZyA9PT0gZmFsc2UpIHtcbiAgICAgICAgY29uc3QgaGVhZEluZGV4ID0gc3cuaGVhZCgpW2luZGV4S2V5XTtcbiAgICAgICAgY29uc3Qgc3RhcnRJbmRleCA9IE1hdGgubWF4KDAsIGhlYWRJbmRleCAtIGJ1ZmZlclJlZnJlc2hTaXplKTtcbiAgICAgICAgaWYgKHN0YXJ0SW5kZXggIT09IGhlYWRJbmRleCkge1xuICAgICAgICAgIGZldGNoaW5nID0gdHJ1ZTtcbiAgICAgICAgICBzb3VyY2VTdHJlYW0ucHVsbChzdGFydEluZGV4LCBidWZmZXJSZWZyZXNoU2l6ZSlcbiAgICAgICAgICAgIC50aGVuKGl0ZW1zID0+IHtcbiAgICAgICAgICAgICAgc3cudW5zaGlmdCguLi5pdGVtcy5tYXAoKGl0ZW0pID0+IE9iamVjdC5hc3NpZ24oaXRlbSwgcm93RmFjdG9yeShpdGVtKSkpKTtcbiAgICAgICAgICAgICAgZmV0Y2hpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG5cbiAgY29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsICgpID0+IHtcbiAgICAgIGNvbnN0IHtzY3JvbGxIZWlnaHQsIHNjcm9sbFRvcCwgb2Zmc2V0SGVpZ2h0fSA9IGNvbnRhaW5lcjtcbiAgICAgIGNvbnN0IHNjcm9sbFJhdGlvID0gKHNjcm9sbFRvcCArIG9mZnNldEhlaWdodCkgLyBzY3JvbGxIZWlnaHQ7XG5cbiAgICAgIGlmIChhbnRlTGFzdFNjcm9sbCkge1xuICAgICAgICBjb25zdCBwcmV2aW91c0RpcmVjdGlvbiA9IChsYXN0U2Nyb2xsIC0gYW50ZUxhc3RTY3JvbGwpID4gMCA/ICdkb3duJyA6ICd1cCc7XG4gICAgICAgIGNvbnN0IGRpcmVjdGlvbiA9IHNjcm9sbFRvcCAtIGxhc3RTY3JvbGwgPiAwID8gJ2Rvd24nIDogJ3VwJztcbiAgICAgICAgY29uc3QgaXNEaXJlY3Rpb25Db25maXJtZWQgPSBwcmV2aW91c0RpcmVjdGlvbiA9PT0gZGlyZWN0aW9uO1xuXG4gICAgICAgIGlmIChpc0RpcmVjdGlvbkNvbmZpcm1lZCkge1xuICAgICAgICAgIGlmIChkaXJlY3Rpb24gPT09ICdkb3duJykge1xuICAgICAgICAgICAgc2Nyb2xsRG93bihzY3JvbGxSYXRpbyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNjcm9sbFVwKHNjcm9sbFJhdGlvKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGFudGVMYXN0U2Nyb2xsID0gbGFzdFNjcm9sbDtcbiAgICAgIGxhc3RTY3JvbGwgPSBzY3JvbGxUb3A7XG4gICAgfVxuICApO1xuXG4gIHRhYmxlLm9uRGlzcGxheUNoYW5nZShpdGVtcyA9PiB7XG4gICAgY29udGFpbmVySW50ZXJmYWNlLmVtcHR5KCk7XG4gICAgc291cmNlU3RyZWFtID0gZGF0YVNvdXJjZSh7dGFibGV9KTtcblxuICAgIHN3ID0gc2xpZGluZ1dpbmRvdyh7YnVmZmVyU2l6ZSwgd2luZG93U2l6ZSwgaW5kZXhLZXl9KTtcbiAgICBzdy5wdXNoKC4uLml0ZW1zLm1hcChyb3dGYWN0b3J5KSk7XG5cbiAgICBjb25zdCB7c2xpY2U6aW5pdGlhbE5vZGVzfSA9IHN3LnNsaWRlKDApO1xuICAgIGNvbnRhaW5lckludGVyZmFjZS5hcHBlbmQoLi4uaW5pdGlhbE5vZGVzLm1hcChuID0+IG4uZG9tKCkpKTtcblxuICAgIC8vc3RhcnQgdG8gZmlsbCB0aGUgYnVmZmVyXG4gICAgc291cmNlU3RyZWFtLnB1bGwoc3cubGVuZ3RoLCBidWZmZXJTaXplIC0gc3cubGVuZ3RoKVxuICAgICAgLnRoZW4oaXRlbXMgPT4ge1xuICAgICAgICBzdy5wdXNoKC4uLml0ZW1zLm1hcChyb3dGYWN0b3J5KSk7XG4gICAgICAgIGlmIChjb250YWluZXJJbnRlcmZhY2UubGVuZ3RoIDwgd2luZG93U2l6ZSkge1xuICAgICAgICAgIGNvbnRhaW5lckludGVyZmFjZS5lbXB0eSgpO1xuICAgICAgICAgIGNvbnN0IHtzbGljZTpub2Rlc30gPSBzdy5zbGlkZSgwKTtcbiAgICAgICAgICBjb250YWluZXJJbnRlcmZhY2UuYXBwZW5kKC4uLm5vZGVzLm1hcChuID0+IG4uZG9tKCkpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH0pO1xufSIsImltcG9ydCB0YWJsZSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcbmltcG9ydCB2aXJ0dWFsaXplciBmcm9tICcuLi9pbmRleEJpcyc7XG5cbmZ1bmN0aW9uIHJvd0ZhY3RvcnkgKGl0ZW0pIHtcbiAgY29uc3Qge2luZGV4LCB2YWx1ZX0gPSBpdGVtO1xuICBjb25zdCBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ0xJJyk7XG4gIGxpLmlubmVySFRNTCA9IGBpZDogJHt2YWx1ZS5pZH07IGluZGV4ICR7aW5kZXh9YDtcbiAgcmV0dXJuIHtcbiAgICBkb20oKXtcbiAgICAgIHJldHVybiBsaTtcbiAgICB9LFxuICAgIGNsZWFuKCl7XG4gICAgfVxuICB9XG59XG5cbmNvbnN0IGRhdGEgPSBbXTtcblxuZm9yIChsZXQgaSA9IDE7IGkgPD0gMTAwMDA7IGkrKykge1xuICBkYXRhLnB1c2goe2lkOiBpfSk7XG59XG5cbmNvbnN0IHQgPSB0YWJsZSh7XG4gIGRhdGEsXG4gIHRhYmxlU3RhdGU6IHtzb3J0OiB7fSwgZmlsdGVyOiB7fSwgc2xpY2U6IHtwYWdlOiAxLCBzaXplOiA1MH19XG59KTtcblxuY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRhaW5lcicpO1xuXG52aXJ0dWFsaXplcih7XG4gIHRhYmxlOiB0LFxuICByb3dGYWN0b3J5LFxuICBjb250YWluZXIsXG4gIC8vIGJ1ZmZlclNpemU6IDgwMCxcbiAgLy8gd2luZG93U2l6ZTogMTUwLFxuICAvLyBpbmRleEtleTogJ2luZGV4JyxcbiAgLy8gdHJlc2hvbGQ6IDAuOFxufSk7XG5cbnQuZXhlYygpOyJdLCJuYW1lcyI6WyJwb2ludGVyIiwiZmlsdGVyIiwic29ydEZhY3RvcnkiLCJzb3J0Iiwic2VhcmNoIiwidGFibGUiLCJjdXJyeSJdLCJtYXBwaW5ncyI6Ijs7O0FBQU8sU0FBUyxJQUFJLEVBQUUsQ0FBQyxFQUFFO0VBQ3ZCLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Q0FDMUI7O0FBRUQsQUFBTyxTQUFTLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxHQUFHLEVBQUU7RUFDdEMsT0FBTyxDQUFDLEdBQUcsSUFBSSxLQUFLLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLEVBQUUsT0FBTyxLQUFLLE9BQU8s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

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

var bufferedWindow = function ({bufferSize = 1000, windowSize = 200} = {}) {

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

var virtualizer = function ({container, table, rowFactory, windowSize = 200, bufferSize = 1000, treshold = 0.8}) {
  let sourceStream = null;
  let buffer = null;
  let fetching = false;
  let lastScroll;
  let anteLastScroll;

  const bufferRefresh = 0.5;
  const bufferRefreshSize = bufferRefresh * bufferSize / 2;

  const containerInterface = containerFactory({element: container, windowSize});

  const scrollDown = (scrollRatio) => {
    if (scrollRatio > treshold) {
      const toAppend = Math.floor(windowSize * (1 - scrollRatio));
      const {shift, slice:nodes} = buffer.slide(toAppend);
      if (shift !== 0) {
        containerInterface.append(...nodes.slice(-shift).map(n => n.dom()));
      }
      const position = buffer.position();
      if (position > bufferRefresh && fetching === false) {
        const tailIndex = buffer.tail().$$index;
        fetching = true;
        sourceStream.pull(tailIndex + 1, bufferRefreshSize)
          .then(items => {
            buffer.push(...items.map(rowFactory));
            fetching = false;
          });
      }
    }
  };

  const scrollUp = (scrollRatio) => {
    if (scrollRatio < (1 - treshold)) {
      const toPrepend = Math.floor(windowSize * (1 - treshold));
      const {shift, slice:nodes} = buffer.slide(-toPrepend);
      if (shift !== 0) {
        containerInterface.prepend(...nodes.slice(0, -shift)
          .reverse()
          .map(n => n.dom())
        );
      }
      const position = buffer.position();
      if (position < bufferRefresh && fetching === false) {
        const headIndex = buffer.head().$$index;
        const startIndex = Math.max(0, headIndex - bufferRefreshSize);
        if (startIndex !== headIndex) {
          fetching = true;
          sourceStream.pull(startIndex, bufferRefreshSize)
            .then(items => {
              buffer.unshift(...items.map(rowFactory));
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

    //todo clean old buffer

    buffer = bufferedWindow({bufferSize, windowSize});
    buffer.push(...items.map(rowFactory));

    const {slice:initialNodes} = buffer.slide(0);
    containerInterface.append(...initialNodes.map(n => n.dom()));

    //start to fill the buffer
    sourceStream.pull(buffer.length, bufferSize - buffer.length)
      .then(items => {
        buffer.push(...items.map(rowFactory));
        if (containerInterface.length < windowSize) {
          containerInterface.empty();
          const {slice:nodes} = buffer.slide(0);
          containerInterface.append(...nodes.map(n => n.dom()));
        }
      });
  });
};

function rowFactory (item) {
  const {index, value} = item;
  const li = document.createElement('TR');
  li.innerHTML = `<td>${value.id}</td><td>${index}</td>`;
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

const container = document.querySelector('tbody'); //document.getElementById('container');

virtualizer({
  table: t,
  rowFactory,
  container,
  // bufferSize: 1000,
  // windowSize: 200,
  treshold: 0.7
});

t.exec();

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zb3J0L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWZpbHRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zZWFyY2gvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZXZlbnRzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2V2ZW50cy5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLW9wZXJhdG9ycy9pbmRleC5qcyIsIi4uL2xpYi9oZWxwZXIuanMiLCIuLi9saWIvZGF0YVNvdXJjZS5qcyIsIi4uL2xpYi9idWZmZXJlZFdpbmRvdy5qcyIsIi4uL2xpYi9jb250YWluZXIuanMiLCIuLi9pbmRleC5qcyIsImluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHBvaW50ZXIgKHBhdGgpIHtcblxuICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcblxuICBmdW5jdGlvbiBwYXJ0aWFsIChvYmogPSB7fSwgcGFydHMgPSBbXSkge1xuICAgIGNvbnN0IHAgPSBwYXJ0cy5zaGlmdCgpO1xuICAgIGNvbnN0IGN1cnJlbnQgPSBvYmpbcF07XG4gICAgcmV0dXJuIChjdXJyZW50ID09PSB1bmRlZmluZWQgfHwgcGFydHMubGVuZ3RoID09PSAwKSA/XG4gICAgICBjdXJyZW50IDogcGFydGlhbChjdXJyZW50LCBwYXJ0cyk7XG4gIH1cblxuICBmdW5jdGlvbiBzZXQgKHRhcmdldCwgbmV3VHJlZSkge1xuICAgIGxldCBjdXJyZW50ID0gdGFyZ2V0O1xuICAgIGNvbnN0IFtsZWFmLCAuLi5pbnRlcm1lZGlhdGVdID0gcGFydHMucmV2ZXJzZSgpO1xuICAgIGZvciAobGV0IGtleSBvZiBpbnRlcm1lZGlhdGUucmV2ZXJzZSgpKSB7XG4gICAgICBpZiAoY3VycmVudFtrZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY3VycmVudFtrZXldID0ge307XG4gICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIGN1cnJlbnRbbGVhZl0gPSBPYmplY3QuYXNzaWduKGN1cnJlbnRbbGVhZl0gfHwge30sIG5ld1RyZWUpO1xuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGdldCh0YXJnZXQpe1xuICAgICAgcmV0dXJuIHBhcnRpYWwodGFyZ2V0LCBbLi4ucGFydHNdKVxuICAgIH0sXG4gICAgc2V0XG4gIH1cbn07XG4iLCJpbXBvcnQge3N3YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5cbmZ1bmN0aW9uIHNvcnRCeVByb3BlcnR5IChwcm9wKSB7XG4gIGNvbnN0IHByb3BHZXR0ZXIgPSBwb2ludGVyKHByb3ApLmdldDtcbiAgcmV0dXJuIChhLCBiKSA9PiB7XG4gICAgY29uc3QgYVZhbCA9IHByb3BHZXR0ZXIoYSk7XG4gICAgY29uc3QgYlZhbCA9IHByb3BHZXR0ZXIoYik7XG5cbiAgICBpZiAoYVZhbCA9PT0gYlZhbCkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgaWYgKGJWYWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cblxuICAgIGlmIChhVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIHJldHVybiBhVmFsIDwgYlZhbCA/IC0xIDogMTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzb3J0RmFjdG9yeSAoe3BvaW50ZXIsIGRpcmVjdGlvbn0gPSB7fSkge1xuICBpZiAoIXBvaW50ZXIgfHwgZGlyZWN0aW9uID09PSAnbm9uZScpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gWy4uLmFycmF5XTtcbiAgfVxuXG4gIGNvbnN0IG9yZGVyRnVuYyA9IHNvcnRCeVByb3BlcnR5KHBvaW50ZXIpO1xuICBjb25zdCBjb21wYXJlRnVuYyA9IGRpcmVjdGlvbiA9PT0gJ2Rlc2MnID8gc3dhcChvcmRlckZ1bmMpIDogb3JkZXJGdW5jO1xuXG4gIHJldHVybiAoYXJyYXkpID0+IFsuLi5hcnJheV0uc29ydChjb21wYXJlRnVuYyk7XG59IiwiaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZnVuY3Rpb24gdHlwZUV4cHJlc3Npb24gKHR5cGUpIHtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gQm9vbGVhbjtcbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuIE51bWJlcjtcbiAgICBjYXNlICdkYXRlJzpcbiAgICAgIHJldHVybiAodmFsKSA9PiBuZXcgRGF0ZSh2YWwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gY29tcG9zZShTdHJpbmcsICh2YWwpID0+IHZhbC50b0xvd2VyQ2FzZSgpKTtcbiAgfVxufVxuXG5jb25zdCBvcGVyYXRvcnMgPSB7XG4gIGluY2x1ZGVzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dC5pbmNsdWRlcyh2YWx1ZSk7XG4gIH0sXG4gIGlzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgaXNOb3QodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+ICFPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgbHQodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDwgdmFsdWU7XG4gIH0sXG4gIGd0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+IHZhbHVlO1xuICB9LFxuICBsdGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDw9IHZhbHVlO1xuICB9LFxuICBndGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0ID49IHZhbHVlO1xuICB9LFxuICBlcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlID09IGlucHV0O1xuICB9LFxuICBub3RFcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlICE9IGlucHV0O1xuICB9XG59O1xuXG5jb25zdCBldmVyeSA9IGZucyA9PiAoLi4uYXJncykgPT4gZm5zLmV2ZXJ5KGZuID0+IGZuKC4uLmFyZ3MpKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHByZWRpY2F0ZSAoe3ZhbHVlID0gJycsIG9wZXJhdG9yID0gJ2luY2x1ZGVzJywgdHlwZSA9ICdzdHJpbmcnfSkge1xuICBjb25zdCB0eXBlSXQgPSB0eXBlRXhwcmVzc2lvbih0eXBlKTtcbiAgY29uc3Qgb3BlcmF0ZU9uVHlwZWQgPSBjb21wb3NlKHR5cGVJdCwgb3BlcmF0b3JzW29wZXJhdG9yXSk7XG4gIGNvbnN0IHByZWRpY2F0ZUZ1bmMgPSBvcGVyYXRlT25UeXBlZCh2YWx1ZSk7XG4gIHJldHVybiBjb21wb3NlKHR5cGVJdCwgcHJlZGljYXRlRnVuYyk7XG59XG5cbi8vYXZvaWQgdXNlbGVzcyBmaWx0ZXIgbG9va3VwIChpbXByb3ZlIHBlcmYpXG5mdW5jdGlvbiBub3JtYWxpemVDbGF1c2VzIChjb25mKSB7XG4gIGNvbnN0IG91dHB1dCA9IHt9O1xuICBjb25zdCB2YWxpZFBhdGggPSBPYmplY3Qua2V5cyhjb25mKS5maWx0ZXIocGF0aCA9PiBBcnJheS5pc0FycmF5KGNvbmZbcGF0aF0pKTtcbiAgdmFsaWRQYXRoLmZvckVhY2gocGF0aCA9PiB7XG4gICAgY29uc3QgdmFsaWRDbGF1c2VzID0gY29uZltwYXRoXS5maWx0ZXIoYyA9PiBjLnZhbHVlICE9PSAnJyk7XG4gICAgaWYgKHZhbGlkQ2xhdXNlcy5sZW5ndGgpIHtcbiAgICAgIG91dHB1dFtwYXRoXSA9IHZhbGlkQ2xhdXNlcztcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmaWx0ZXIgKGZpbHRlcikge1xuICBjb25zdCBub3JtYWxpemVkQ2xhdXNlcyA9IG5vcm1hbGl6ZUNsYXVzZXMoZmlsdGVyKTtcbiAgY29uc3QgZnVuY0xpc3QgPSBPYmplY3Qua2V5cyhub3JtYWxpemVkQ2xhdXNlcykubWFwKHBhdGggPT4ge1xuICAgIGNvbnN0IGdldHRlciA9IHBvaW50ZXIocGF0aCkuZ2V0O1xuICAgIGNvbnN0IGNsYXVzZXMgPSBub3JtYWxpemVkQ2xhdXNlc1twYXRoXS5tYXAocHJlZGljYXRlKTtcbiAgICByZXR1cm4gY29tcG9zZShnZXR0ZXIsIGV2ZXJ5KGNsYXVzZXMpKTtcbiAgfSk7XG4gIGNvbnN0IGZpbHRlclByZWRpY2F0ZSA9IGV2ZXJ5KGZ1bmNMaXN0KTtcblxuICByZXR1cm4gKGFycmF5KSA9PiBhcnJheS5maWx0ZXIoZmlsdGVyUHJlZGljYXRlKTtcbn0iLCJpbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc2VhcmNoQ29uZiA9IHt9KSB7XG4gIGNvbnN0IHt2YWx1ZSwgc2NvcGUgPSBbXX0gPSBzZWFyY2hDb25mO1xuICBjb25zdCBzZWFyY2hQb2ludGVycyA9IHNjb3BlLm1hcChmaWVsZCA9PiBwb2ludGVyKGZpZWxkKS5nZXQpO1xuICBpZiAoIXNjb3BlLmxlbmd0aCB8fCAhdmFsdWUpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gYXJyYXk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5LmZpbHRlcihpdGVtID0+IHNlYXJjaFBvaW50ZXJzLnNvbWUocCA9PiBTdHJpbmcocChpdGVtKSkuaW5jbHVkZXMoU3RyaW5nKHZhbHVlKSkpKVxuICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc2xpY2VGYWN0b3J5ICh7cGFnZSA9IDEsIHNpemV9ID0ge30pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHNsaWNlRnVuY3Rpb24gKGFycmF5ID0gW10pIHtcbiAgICBjb25zdCBhY3R1YWxTaXplID0gc2l6ZSB8fCBhcnJheS5sZW5ndGg7XG4gICAgY29uc3Qgb2Zmc2V0ID0gKHBhZ2UgLSAxKSAqIGFjdHVhbFNpemU7XG4gICAgcmV0dXJuIGFycmF5LnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgYWN0dWFsU2l6ZSk7XG4gIH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZW1pdHRlciAoKSB7XG5cbiAgY29uc3QgbGlzdGVuZXJzTGlzdHMgPSB7fTtcblxuICByZXR1cm4ge1xuICAgIG9uKGV2ZW50LCAuLi5saXN0ZW5lcnMpe1xuICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gKGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXSkuY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGRpc3BhdGNoKGV2ZW50LCAuLi5hcmdzKXtcbiAgICAgIGNvbnN0IGxpc3RlbmVycyA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIGxpc3RlbmVycykge1xuICAgICAgICBsaXN0ZW5lciguLi5hcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgb2ZmKGV2ZW50LCAuLi5saXN0ZW5lcnMpe1xuICAgICAgaWYgKCFldmVudCkge1xuICAgICAgICBPYmplY3Qua2V5cyhsaXN0ZW5lcnNMaXN0cykuZm9yRWFjaChldiA9PiB0aGlzLm9mZihldikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gbGlzdGVuZXJzLmxlbmd0aCA/IGxpc3QuZmlsdGVyKGxpc3RlbmVyID0+ICFsaXN0ZW5lcnMuaW5jbHVkZXMobGlzdGVuZXIpKSA6IFtdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm94eUxpc3RlbmVyIChldmVudE1hcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKHtlbWl0dGVyfSkge1xuXG4gICAgY29uc3QgcHJveHkgPSB7fTtcbiAgICBsZXQgZXZlbnRMaXN0ZW5lcnMgPSB7fTtcblxuICAgIGZvciAobGV0IGV2IG9mIE9iamVjdC5rZXlzKGV2ZW50TWFwKSkge1xuICAgICAgY29uc3QgbWV0aG9kID0gZXZlbnRNYXBbZXZdO1xuICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gW107XG4gICAgICBwcm94eVttZXRob2RdID0gZnVuY3Rpb24gKC4uLmxpc3RlbmVycykge1xuICAgICAgICBldmVudExpc3RlbmVyc1tldl0gPSBldmVudExpc3RlbmVyc1tldl0uY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICAgIGVtaXR0ZXIub24oZXYsIC4uLmxpc3RlbmVycyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihwcm94eSwge1xuICAgICAgb2ZmKGV2KXtcbiAgICAgICAgaWYgKCFldikge1xuICAgICAgICAgIE9iamVjdC5rZXlzKGV2ZW50TGlzdGVuZXJzKS5mb3JFYWNoKGV2ZW50TmFtZSA9PiB0aGlzLm9mZihldmVudE5hbWUpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudExpc3RlbmVyc1tldl0pIHtcbiAgICAgICAgICBlbWl0dGVyLm9mZihldiwgLi4uZXZlbnRMaXN0ZW5lcnNbZXZdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59IiwiZXhwb3J0IGNvbnN0IFRPR0dMRV9TT1JUID0gJ1RPR0dMRV9TT1JUJztcbmV4cG9ydCBjb25zdCBESVNQTEFZX0NIQU5HRUQgPSAnRElTUExBWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBQQUdFX0NIQU5HRUQgPSAnQ0hBTkdFX1BBR0UnO1xuZXhwb3J0IGNvbnN0IEVYRUNfQ0hBTkdFRCA9ICdFWEVDX1NUQVJURUQnO1xuZXhwb3J0IGNvbnN0IEZJTFRFUl9DSEFOR0VEID0gJ0ZJTFRFUl9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTVU1NQVJZX0NIQU5HRUQgPSAnU1VNTUFSWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTRUFSQ0hfQ0hBTkdFRCA9ICdTRUFSQ0hfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRVhFQ19FUlJPUiA9ICdFWEVDX0VSUk9SJzsiLCJpbXBvcnQgc2xpY2UgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtjdXJyeSwgdGFwLCBjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcbmltcG9ydCB7ZW1pdHRlcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcbmltcG9ydCBzbGljZUZhY3RvcnkgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtcbiAgU1VNTUFSWV9DSEFOR0VELFxuICBUT0dHTEVfU09SVCxcbiAgRElTUExBWV9DSEFOR0VELFxuICBQQUdFX0NIQU5HRUQsXG4gIEVYRUNfQ0hBTkdFRCxcbiAgRklMVEVSX0NIQU5HRUQsXG4gIFNFQVJDSF9DSEFOR0VELFxuICBFWEVDX0VSUk9SXG59IGZyb20gJy4uL2V2ZW50cyc7XG5cbmZ1bmN0aW9uIGN1cnJpZWRQb2ludGVyIChwYXRoKSB7XG4gIGNvbnN0IHtnZXQsIHNldH0gPSBwb2ludGVyKHBhdGgpO1xuICByZXR1cm4ge2dldCwgc2V0OiBjdXJyeShzZXQpfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtcbiAgc29ydEZhY3RvcnksXG4gIHRhYmxlU3RhdGUsXG4gIGRhdGEsXG4gIGZpbHRlckZhY3RvcnksXG4gIHNlYXJjaEZhY3Rvcnlcbn0pIHtcbiAgY29uc3QgdGFibGUgPSBlbWl0dGVyKCk7XG4gIGNvbnN0IHNvcnRQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NvcnQnKTtcbiAgY29uc3Qgc2xpY2VQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NsaWNlJyk7XG4gIGNvbnN0IGZpbHRlclBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignZmlsdGVyJyk7XG4gIGNvbnN0IHNlYXJjaFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2VhcmNoJyk7XG5cbiAgY29uc3Qgc2FmZUFzc2lnbiA9IGN1cnJ5KChiYXNlLCBleHRlbnNpb24pID0+IE9iamVjdC5hc3NpZ24oe30sIGJhc2UsIGV4dGVuc2lvbikpO1xuICBjb25zdCBkaXNwYXRjaCA9IGN1cnJ5KHRhYmxlLmRpc3BhdGNoLmJpbmQodGFibGUpLCAyKTtcblxuICBjb25zdCBjcmVhdGVTdW1tYXJ5ID0gKGZpbHRlcmVkKSA9PiB7XG4gICAgZGlzcGF0Y2goU1VNTUFSWV9DSEFOR0VELCB7XG4gICAgICBwYWdlOiB0YWJsZVN0YXRlLnNsaWNlLnBhZ2UsXG4gICAgICBzaXplOiB0YWJsZVN0YXRlLnNsaWNlLnNpemUsXG4gICAgICBmaWx0ZXJlZENvdW50OiBmaWx0ZXJlZC5sZW5ndGhcbiAgICB9KTtcbiAgfTtcblxuICBjb25zdCBleGVjID0gKHtwcm9jZXNzaW5nRGVsYXkgPSAyMH0gPSB7fSkgPT4ge1xuICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfQ0hBTkdFRCwge3dvcmtpbmc6IHRydWV9KTtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc2VhcmNoRnVuYyA9IHNlYXJjaEZhY3Rvcnkoc2VhcmNoUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzb3J0RnVuYyA9IHNvcnRGYWN0b3J5KHNvcnRQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNsaWNlRnVuYyA9IHNsaWNlRmFjdG9yeShzbGljZVBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3QgZXhlY0Z1bmMgPSBjb21wb3NlKGZpbHRlckZ1bmMsIHNlYXJjaEZ1bmMsIHRhcChjcmVhdGVTdW1tYXJ5KSwgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgIGNvbnN0IGRpc3BsYXllZCA9IGV4ZWNGdW5jKGRhdGEpO1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChESVNQTEFZX0NIQU5HRUQsIGRpc3BsYXllZC5tYXAoZCA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH07XG4gICAgICAgIH0pKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19FUlJPUiwgZSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiBmYWxzZX0pO1xuICAgICAgfVxuICAgIH0sIHByb2Nlc3NpbmdEZWxheSk7XG4gIH07XG5cbiAgY29uc3QgdXBkYXRlVGFibGVTdGF0ZSA9IGN1cnJ5KChwdGVyLCBldiwgbmV3UGFydGlhbFN0YXRlKSA9PiBjb21wb3NlKFxuICAgIHNhZmVBc3NpZ24ocHRlci5nZXQodGFibGVTdGF0ZSkpLFxuICAgIHRhcChkaXNwYXRjaChldikpLFxuICAgIHB0ZXIuc2V0KHRhYmxlU3RhdGUpXG4gICkobmV3UGFydGlhbFN0YXRlKSk7XG5cbiAgY29uc3QgcmVzZXRUb0ZpcnN0UGFnZSA9ICgpID0+IHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQsIHtwYWdlOiAxfSk7XG5cbiAgY29uc3QgdGFibGVPcGVyYXRpb24gPSAocHRlciwgZXYpID0+IGNvbXBvc2UoXG4gICAgdXBkYXRlVGFibGVTdGF0ZShwdGVyLCBldiksXG4gICAgcmVzZXRUb0ZpcnN0UGFnZSxcbiAgICAoKSA9PiB0YWJsZS5leGVjKCkgLy8gd2Ugd3JhcCB3aXRoaW4gYSBmdW5jdGlvbiBzbyB0YWJsZS5leGVjIGNhbiBiZSBvdmVyd3JpdHRlbiAod2hlbiB1c2luZyB3aXRoIGEgc2VydmVyIGZvciBleGFtcGxlKVxuICApO1xuXG4gIGNvbnN0IGFwaSA9IHtcbiAgICBzb3J0OiB0YWJsZU9wZXJhdGlvbihzb3J0UG9pbnRlciwgVE9HR0xFX1NPUlQpLFxuICAgIGZpbHRlcjogdGFibGVPcGVyYXRpb24oZmlsdGVyUG9pbnRlciwgRklMVEVSX0NIQU5HRUQpLFxuICAgIHNlYXJjaDogdGFibGVPcGVyYXRpb24oc2VhcmNoUG9pbnRlciwgU0VBUkNIX0NIQU5HRUQpLFxuICAgIHNsaWNlOiBjb21wb3NlKHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQpLCAoKSA9PiB0YWJsZS5leGVjKCkpLFxuICAgIGV4ZWMsXG4gICAgZXZhbChzdGF0ZSA9IHRhYmxlU3RhdGUpe1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBjb25zdCBzb3J0RnVuYyA9IHNvcnRGYWN0b3J5KHNvcnRQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCBzb3J0RnVuYywgc2xpY2VGdW5jKTtcbiAgICAgICAgICByZXR1cm4gZXhlY0Z1bmMoZGF0YSkubWFwKGQgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBvbkRpc3BsYXlDaGFuZ2UoZm4pe1xuICAgICAgdGFibGUub24oRElTUExBWV9DSEFOR0VELCBmbik7XG4gICAgfSxcbiAgICBnZXRUYWJsZVN0YXRlKCl7XG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZSlcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24odGFibGUsIGFwaSk7XG59IiwiaW1wb3J0IHNvcnQgZnJvbSAnc21hcnQtdGFibGUtc29ydCc7XG5pbXBvcnQgZmlsdGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWZpbHRlcic7XG5pbXBvcnQgc2VhcmNoIGZyb20gJ3NtYXJ0LXRhYmxlLXNlYXJjaCc7XG5pbXBvcnQgdGFibGUgZnJvbSAnLi9kaXJlY3RpdmVzL3RhYmxlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtcbiAgc29ydEZhY3RvcnkgPSBzb3J0LFxuICBmaWx0ZXJGYWN0b3J5ID0gZmlsdGVyLFxuICBzZWFyY2hGYWN0b3J5ID0gc2VhcmNoLFxuICB0YWJsZVN0YXRlID0ge3NvcnQ6IHt9LCBzbGljZToge3BhZ2U6IDF9LCBmaWx0ZXI6IHt9LCBzZWFyY2g6IHt9fSxcbiAgZGF0YSA9IFtdXG59LCAuLi50YWJsZURpcmVjdGl2ZXMpIHtcblxuICBjb25zdCBjb3JlVGFibGUgPSB0YWJsZSh7c29ydEZhY3RvcnksIGZpbHRlckZhY3RvcnksIHRhYmxlU3RhdGUsIGRhdGEsIHNlYXJjaEZhY3Rvcnl9KTtcblxuICByZXR1cm4gdGFibGVEaXJlY3RpdmVzLnJlZHVjZSgoYWNjdW11bGF0b3IsIG5ld2RpcikgPT4ge1xuICAgIHJldHVybiBPYmplY3QuYXNzaWduKGFjY3VtdWxhdG9yLCBuZXdkaXIoe1xuICAgICAgc29ydEZhY3RvcnksXG4gICAgICBmaWx0ZXJGYWN0b3J5LFxuICAgICAgc2VhcmNoRmFjdG9yeSxcbiAgICAgIHRhYmxlU3RhdGUsXG4gICAgICBkYXRhLFxuICAgICAgdGFibGU6IGNvcmVUYWJsZVxuICAgIH0pKTtcbiAgfSwgY29yZVRhYmxlKTtcbn0iLCJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJpbXBvcnQge2N1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5leHBvcnQgZnVuY3Rpb24qIGdpdmVNZU4gKG4pIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyBpKyspIHtcbiAgICB5aWVsZCBpO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBkb05UaW1lcyA9IGN1cnJ5KChmbiwgY291bnQgPSAxKSA9PiB7XG4gIGNvbnN0IG4gPSBjb3VudCB8fCAxO1xuICBbLi4uZ2l2ZU1lTihuKV0uZm9yRWFjaCgoKSA9PiBmbigpKTtcbn0sIDIpO1xuIiwiaW1wb3J0IHtnaXZlTWVOfSBmcm9tICcuL2hlbHBlcic7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGV9KSB7XG4gIHJldHVybiB7XG4gICAgcHVsbChvZmZzZXQsIG51bWJlcil7XG4gICAgICBjb25zdCB0YWJsZVN0YXRlID0gdGFibGUuZ2V0VGFibGVTdGF0ZSgpO1xuICAgICAgY29uc3Qge3NsaWNlOntzaXplOnBhZ2VTaXplfX0gPSB0YWJsZVN0YXRlO1xuICAgICAgY29uc3Qgc3RhcnRQYWdlID0gTWF0aC5mbG9vcihvZmZzZXQgLyBwYWdlU2l6ZSk7XG4gICAgICBjb25zdCB0cmltQmVmb3JlID0gb2Zmc2V0ICUgcGFnZVNpemU7XG4gICAgICBjb25zdCBsYXN0UGFnZSA9IE1hdGguY2VpbCgob2Zmc2V0ICsgbnVtYmVyKSAvIHBhZ2VTaXplKTtcbiAgICAgIGNvbnN0IHBhZ2VDb25mTGlzdCA9IFsuLi5naXZlTWVOKGxhc3RQYWdlIC0gc3RhcnRQYWdlKV0ubWFwKG9mZiA9PiAoe1xuICAgICAgICBwYWdlOiBzdGFydFBhZ2UgKyBvZmYgKyAxLFxuICAgICAgICBzaXplOiBwYWdlU2l6ZVxuICAgICAgfSkpO1xuICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHBhZ2VDb25mTGlzdC5tYXAoc2xpY2UgPT4ge1xuICAgICAgICByZXR1cm4gdGFibGUuZXZhbChPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLCB7c2xpY2V9KSk7XG4gICAgICB9LCBbXSkpXG4gICAgICAgIC50aGVuKHBhZ2VzID0+IHtcbiAgICAgICAgICByZXR1cm4gcGFnZXMucmVkdWNlKChhY2MsIGN1cnIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhY2MuY29uY2F0KGN1cnIpO1xuICAgICAgICAgIH0sIFtdKVxuICAgICAgICAgICAgLmZpbHRlcigoaXRlbSwgaW5kZXgpID0+IGluZGV4ID49IHRyaW1CZWZvcmUpXG4gICAgICAgICAgICAuc2xpY2UoMCwgbnVtYmVyKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICB9O1xufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7YnVmZmVyU2l6ZSA9IDEwMDAsIHdpbmRvd1NpemUgPSAyMDB9ID0ge30pIHtcblxuICBjb25zdCBkYXRhTGlzdCA9IFtdO1xuICBsZXQgd2luZG93Q3Vyc29yID0gbnVsbDtcblxuICBjb25zdCBpbnN0YW5jZSA9IHtcbiAgICBwdXNoKCl7XG4gICAgICBjb25zdCBpdGVtcyA9IFsuLi5hcmd1bWVudHNdO1xuICAgICAgY29uc3QgbWF4UmVtb3ZhYmxlSXRlbUNvdW50ID0gTWF0aC5taW4oZGF0YUxpc3QuaW5kZXhPZih3aW5kb3dDdXJzb3IpLCBpdGVtcy5sZW5ndGgpO1xuICAgICAgY29uc3QgbGltaXQgPSBkYXRhTGlzdC5sZW5ndGggPCBidWZmZXJTaXplID8gYnVmZmVyU2l6ZSAtIGRhdGFMaXN0Lmxlbmd0aCA6IG1heFJlbW92YWJsZUl0ZW1Db3VudDtcbiAgICAgIGNvbnN0IHRvQXBwZW5kID0gaXRlbXMuc2xpY2UoMCwgbGltaXQpO1xuICAgICAgY29uc3QgdGFpbEl0ZW0gPSBpbnN0YW5jZS50YWlsKCk7XG4gICAgICBjb25zdCBzdGFydEluZGV4ID0gdGFpbEl0ZW0gPyB0YWlsSXRlbS4kJGluZGV4ICsgMSA6IDA7XG4gICAgICBkYXRhTGlzdC5wdXNoKC4uLnRvQXBwZW5kLm1hcCgoaXRlbSwgb2Zmc2V0KSA9PiBPYmplY3QuYXNzaWduKHskJGluZGV4OiBzdGFydEluZGV4ICsgb2Zmc2V0fSwgaXRlbSkpKTtcbiAgICAgIGlmIChkYXRhTGlzdC5sZW5ndGggPiBidWZmZXJTaXplKSB7XG4gICAgICAgIGNvbnN0IHRvRHJvcCA9IGRhdGFMaXN0LnNwbGljZSgwLCBsaW1pdCk7XG4gICAgICAgIHRvRHJvcC5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgICAgIGlmIChpdGVtLmNsZWFuKSB7XG4gICAgICAgICAgICBpdGVtLmNsZWFuKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHVuc2hpZnQoKXtcbiAgICAgIGNvbnN0IGl0ZW1zID0gWy4uLmFyZ3VtZW50c107XG4gICAgICBjb25zdCB1cHBlcldpbmRvd0luZGV4ID0gTWF0aC5taW4oZGF0YUxpc3QuaW5kZXhPZih3aW5kb3dDdXJzb3IpICsgd2luZG93U2l6ZSwgZGF0YUxpc3QubGVuZ3RoIC0gMSk7XG4gICAgICBjb25zdCBtYXhSZW1vdmFibGVJdGVtQ291bnQgPSBNYXRoLm1pbihkYXRhTGlzdC5sZW5ndGggLSB1cHBlcldpbmRvd0luZGV4LCBpdGVtcy5sZW5ndGgpO1xuICAgICAgY29uc3QgbGltaXQgPSBkYXRhTGlzdC5sZW5ndGggPCBidWZmZXJTaXplID8gYnVmZmVyU2l6ZSAtIGRhdGFMaXN0Lmxlbmd0aCA6IG1heFJlbW92YWJsZUl0ZW1Db3VudDtcbiAgICAgIGNvbnN0IHRvUHJlcGVuZCA9IGl0ZW1zLnNsaWNlKDAsIGxpbWl0KTtcbiAgICAgIGNvbnN0IHN0YXJ0SW5kZXggPSBpbnN0YW5jZS5oZWFkKCkuJCRpbmRleCAtIGxpbWl0O1xuICAgICAgZGF0YUxpc3QudW5zaGlmdCguLi50b1ByZXBlbmQubWFwKChpdGVtLCBvZmZzZXQpID0+IE9iamVjdC5hc3NpZ24oeyQkaW5kZXg6IHN0YXJ0SW5kZXggKyBvZmZzZXR9LCBpdGVtKSkpO1xuICAgICAgaWYgKGRhdGFMaXN0Lmxlbmd0aCA+IGJ1ZmZlclNpemUpIHtcbiAgICAgICAgY29uc3QgdG9Ecm9wID0gZGF0YUxpc3Quc3BsaWNlKC1saW1pdCk7XG4gICAgICAgIHRvRHJvcC5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgICAgIGlmIChpdGVtLmNsZWFuKSB7XG4gICAgICAgICAgICBpdGVtLmNsZWFuKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGdldChpbmRleCl7XG4gICAgICByZXR1cm4gZGF0YUxpc3QuZmluZChpdGVtID0+IGl0ZW0uJCRpbmRleCA9PT0gaW5kZXgpO1xuICAgIH0sXG4gICAgaGVhZCgpe1xuICAgICAgcmV0dXJuIGRhdGFMaXN0WzBdIHx8IG51bGw7XG4gICAgfSxcbiAgICB0YWlsKCl7XG4gICAgICByZXR1cm4gZGF0YUxpc3QubGVuZ3RoID8gZGF0YUxpc3RbZGF0YUxpc3QubGVuZ3RoIC0gMV0gOiBudWxsO1xuICAgIH0sXG4gICAgc2xpZGUob2Zmc2V0KXtcbiAgICAgIGNvbnN0IGN1cnNvckluZGV4ID0gZGF0YUxpc3QuaW5kZXhPZih3aW5kb3dDdXJzb3IpIHx8IDA7XG4gICAgICBjb25zdCBpbmRleCA9IE1hdGgubWF4KGN1cnNvckluZGV4ICsgb2Zmc2V0LCAwKTtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gaW5kZXggKyB3aW5kb3dTaXplID49IChidWZmZXJTaXplIC0gMSkgPyBidWZmZXJTaXplIC0gd2luZG93U2l6ZSA6IGluZGV4O1xuICAgICAgY29uc3Qgc2xpY2UgPSBkYXRhTGlzdC5zbGljZShzdGFydCwgc3RhcnQgKyB3aW5kb3dTaXplKTtcbiAgICAgIGNvbnN0IHNoaWZ0ID0gc3RhcnQgLSBjdXJzb3JJbmRleDtcbiAgICAgIHdpbmRvd0N1cnNvciA9IGRhdGFMaXN0W3N0YXJ0XTtcbiAgICAgIHJldHVybiB7c2xpY2UsIHNoaWZ0fTtcbiAgICB9LFxuICAgIHBvc2l0aW9uKCl7XG4gICAgICByZXR1cm4gKGRhdGFMaXN0LmluZGV4T2Yod2luZG93Q3Vyc29yKSArIDEpIC8gKGJ1ZmZlclNpemUgLSB3aW5kb3dTaXplKTtcbiAgICB9XG4gIH07XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGluc3RhbmNlLCAnbGVuZ3RoJywge1xuICAgIGdldCgpe1xuICAgICAgcmV0dXJuIGRhdGFMaXN0Lmxlbmd0aDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn0iLCJpbXBvcnQge2RvTlRpbWVzfSBmcm9tICcuL2hlbHBlcidcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtlbGVtZW50LCB3aW5kb3dTaXplfSkge1xuXG4gIGNvbnN0IGluc3RhbmNlID0ge1xuICAgIGFwcGVuZCguLi5hcmdzKXtcbiAgICAgIGZvciAobGV0IGl0ZW0gb2YgYXJncykge1xuICAgICAgICBlbGVtZW50LmFwcGVuZENoaWxkKGl0ZW0pO1xuICAgICAgICBpZiAoaW5zdGFuY2UubGVuZ3RoID4gd2luZG93U2l6ZSkge1xuICAgICAgICAgIGluc3RhbmNlLmRyb3BCZWdpbihpbnN0YW5jZS5sZW5ndGggLSB3aW5kb3dTaXplKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgcHJlcGVuZCguLi5hcmdzKXtcbiAgICAgIGZvciAobGV0IGl0ZW0gb2YgYXJncykge1xuICAgICAgICBlbGVtZW50Lmluc2VydEJlZm9yZShpdGVtLCBlbGVtZW50LmZpcnN0Q2hpbGQpO1xuICAgICAgICBpZiAoaW5zdGFuY2UubGVuZ3RoID4gd2luZG93U2l6ZSkge1xuICAgICAgICAgIGluc3RhbmNlLmRyb3BFbmQoaW5zdGFuY2UubGVuZ3RoIC0gd2luZG93U2l6ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGRyb3BCZWdpbjogZG9OVGltZXMoKCkgPT4ge1xuICAgICAgY29uc3QgZmlyc3RDaGlsZCA9IGVsZW1lbnQuZmlyc3RDaGlsZDtcbiAgICAgIGlmIChmaXJzdENoaWxkKSB7XG4gICAgICAgIGZpcnN0Q2hpbGQucmVtb3ZlKCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgZHJvcEVuZDogZG9OVGltZXMoKCkgPT4ge1xuICAgICAgY29uc3QgbGFzdENoaWxkID0gZWxlbWVudC5sYXN0Q2hpbGQ7XG4gICAgICBpZiAobGFzdENoaWxkKSB7XG4gICAgICAgIGxhc3RDaGlsZC5yZW1vdmUoKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICBlbXB0eSgpe1xuICAgICAgZWxlbWVudC5pbm5lckhUTUwgPSAnJztcbiAgICB9XG4gIH07XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGluc3RhbmNlLCAnbGVuZ3RoJywge1xuICAgIGdldCgpe1xuICAgICAgcmV0dXJuIGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufSIsImltcG9ydCBkYXRhU291cmNlIGZyb20gJy4vbGliL2RhdGFTb3VyY2UnO1xuaW1wb3J0IGJ1ZmZlcmVkV2luZG93IGZyb20gJy4vbGliL2J1ZmZlcmVkV2luZG93JztcbmltcG9ydCBjb250YWluZXJGYWN0b3J5IGZyb20gJy4vbGliL2NvbnRhaW5lcic7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7Y29udGFpbmVyLCB0YWJsZSwgcm93RmFjdG9yeSwgd2luZG93U2l6ZSA9IDIwMCwgYnVmZmVyU2l6ZSA9IDEwMDAsIHRyZXNob2xkID0gMC44fSkge1xuICBsZXQgc291cmNlU3RyZWFtID0gbnVsbDtcbiAgbGV0IGJ1ZmZlciA9IG51bGw7XG4gIGxldCBmZXRjaGluZyA9IGZhbHNlO1xuICBsZXQgbGFzdFNjcm9sbDtcbiAgbGV0IGFudGVMYXN0U2Nyb2xsO1xuXG4gIGNvbnN0IGJ1ZmZlclJlZnJlc2ggPSAwLjU7XG4gIGNvbnN0IGJ1ZmZlclJlZnJlc2hTaXplID0gYnVmZmVyUmVmcmVzaCAqIGJ1ZmZlclNpemUgLyAyO1xuXG4gIGNvbnN0IGNvbnRhaW5lckludGVyZmFjZSA9IGNvbnRhaW5lckZhY3Rvcnkoe2VsZW1lbnQ6IGNvbnRhaW5lciwgd2luZG93U2l6ZX0pO1xuXG4gIGNvbnN0IHNjcm9sbERvd24gPSAoc2Nyb2xsUmF0aW8pID0+IHtcbiAgICBpZiAoc2Nyb2xsUmF0aW8gPiB0cmVzaG9sZCkge1xuICAgICAgY29uc3QgdG9BcHBlbmQgPSBNYXRoLmZsb29yKHdpbmRvd1NpemUgKiAoMSAtIHNjcm9sbFJhdGlvKSk7XG4gICAgICBjb25zdCB7c2hpZnQsIHNsaWNlOm5vZGVzfSA9IGJ1ZmZlci5zbGlkZSh0b0FwcGVuZCk7XG4gICAgICBpZiAoc2hpZnQgIT09IDApIHtcbiAgICAgICAgY29udGFpbmVySW50ZXJmYWNlLmFwcGVuZCguLi5ub2Rlcy5zbGljZSgtc2hpZnQpLm1hcChuID0+IG4uZG9tKCkpKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHBvc2l0aW9uID0gYnVmZmVyLnBvc2l0aW9uKCk7XG4gICAgICBpZiAocG9zaXRpb24gPiBidWZmZXJSZWZyZXNoICYmIGZldGNoaW5nID09PSBmYWxzZSkge1xuICAgICAgICBjb25zdCB0YWlsSW5kZXggPSBidWZmZXIudGFpbCgpLiQkaW5kZXg7XG4gICAgICAgIGZldGNoaW5nID0gdHJ1ZTtcbiAgICAgICAgc291cmNlU3RyZWFtLnB1bGwodGFpbEluZGV4ICsgMSwgYnVmZmVyUmVmcmVzaFNpemUpXG4gICAgICAgICAgLnRoZW4oaXRlbXMgPT4ge1xuICAgICAgICAgICAgYnVmZmVyLnB1c2goLi4uaXRlbXMubWFwKHJvd0ZhY3RvcnkpKTtcbiAgICAgICAgICAgIGZldGNoaW5nID0gZmFsc2U7XG4gICAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHNjcm9sbFVwID0gKHNjcm9sbFJhdGlvKSA9PiB7XG4gICAgaWYgKHNjcm9sbFJhdGlvIDwgKDEgLSB0cmVzaG9sZCkpIHtcbiAgICAgIGNvbnN0IHRvUHJlcGVuZCA9IE1hdGguZmxvb3Iod2luZG93U2l6ZSAqICgxIC0gdHJlc2hvbGQpKTtcbiAgICAgIGNvbnN0IHtzaGlmdCwgc2xpY2U6bm9kZXN9ID0gYnVmZmVyLnNsaWRlKC10b1ByZXBlbmQpO1xuICAgICAgaWYgKHNoaWZ0ICE9PSAwKSB7XG4gICAgICAgIGNvbnRhaW5lckludGVyZmFjZS5wcmVwZW5kKC4uLm5vZGVzLnNsaWNlKDAsIC1zaGlmdClcbiAgICAgICAgICAucmV2ZXJzZSgpXG4gICAgICAgICAgLm1hcChuID0+IG4uZG9tKCkpXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBjb25zdCBwb3NpdGlvbiA9IGJ1ZmZlci5wb3NpdGlvbigpO1xuICAgICAgaWYgKHBvc2l0aW9uIDwgYnVmZmVyUmVmcmVzaCAmJiBmZXRjaGluZyA9PT0gZmFsc2UpIHtcbiAgICAgICAgY29uc3QgaGVhZEluZGV4ID0gYnVmZmVyLmhlYWQoKS4kJGluZGV4O1xuICAgICAgICBjb25zdCBzdGFydEluZGV4ID0gTWF0aC5tYXgoMCwgaGVhZEluZGV4IC0gYnVmZmVyUmVmcmVzaFNpemUpO1xuICAgICAgICBpZiAoc3RhcnRJbmRleCAhPT0gaGVhZEluZGV4KSB7XG4gICAgICAgICAgZmV0Y2hpbmcgPSB0cnVlO1xuICAgICAgICAgIHNvdXJjZVN0cmVhbS5wdWxsKHN0YXJ0SW5kZXgsIGJ1ZmZlclJlZnJlc2hTaXplKVxuICAgICAgICAgICAgLnRoZW4oaXRlbXMgPT4ge1xuICAgICAgICAgICAgICBidWZmZXIudW5zaGlmdCguLi5pdGVtcy5tYXAocm93RmFjdG9yeSkpO1xuICAgICAgICAgICAgICBmZXRjaGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgY29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsICgpID0+IHtcbiAgICAgIGNvbnN0IHtzY3JvbGxIZWlnaHQsIHNjcm9sbFRvcCwgb2Zmc2V0SGVpZ2h0fSA9IGNvbnRhaW5lcjtcbiAgICAgIGNvbnN0IHNjcm9sbFJhdGlvID0gKHNjcm9sbFRvcCArIG9mZnNldEhlaWdodCkgLyBzY3JvbGxIZWlnaHQ7XG5cbiAgICAgIGlmIChhbnRlTGFzdFNjcm9sbCkge1xuICAgICAgICBjb25zdCBwcmV2aW91c0RpcmVjdGlvbiA9IChsYXN0U2Nyb2xsIC0gYW50ZUxhc3RTY3JvbGwpID4gMCA/ICdkb3duJyA6ICd1cCc7XG4gICAgICAgIGNvbnN0IGRpcmVjdGlvbiA9IHNjcm9sbFRvcCAtIGxhc3RTY3JvbGwgPiAwID8gJ2Rvd24nIDogJ3VwJztcbiAgICAgICAgY29uc3QgaXNEaXJlY3Rpb25Db25maXJtZWQgPSBwcmV2aW91c0RpcmVjdGlvbiA9PT0gZGlyZWN0aW9uO1xuXG4gICAgICAgIGlmIChpc0RpcmVjdGlvbkNvbmZpcm1lZCkge1xuICAgICAgICAgIGlmIChkaXJlY3Rpb24gPT09ICdkb3duJykge1xuICAgICAgICAgICAgc2Nyb2xsRG93bihzY3JvbGxSYXRpbyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNjcm9sbFVwKHNjcm9sbFJhdGlvKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGFudGVMYXN0U2Nyb2xsID0gbGFzdFNjcm9sbDtcbiAgICAgIGxhc3RTY3JvbGwgPSBzY3JvbGxUb3A7XG4gICAgfVxuICApO1xuXG4gIHRhYmxlLm9uRGlzcGxheUNoYW5nZShpdGVtcyA9PiB7XG4gICAgY29udGFpbmVySW50ZXJmYWNlLmVtcHR5KCk7XG4gICAgc291cmNlU3RyZWFtID0gZGF0YVNvdXJjZSh7dGFibGV9KTtcblxuICAgIC8vdG9kbyBjbGVhbiBvbGQgYnVmZmVyXG5cbiAgICBidWZmZXIgPSBidWZmZXJlZFdpbmRvdyh7YnVmZmVyU2l6ZSwgd2luZG93U2l6ZX0pO1xuICAgIGJ1ZmZlci5wdXNoKC4uLml0ZW1zLm1hcChyb3dGYWN0b3J5KSk7XG5cbiAgICBjb25zdCB7c2xpY2U6aW5pdGlhbE5vZGVzfSA9IGJ1ZmZlci5zbGlkZSgwKTtcbiAgICBjb250YWluZXJJbnRlcmZhY2UuYXBwZW5kKC4uLmluaXRpYWxOb2Rlcy5tYXAobiA9PiBuLmRvbSgpKSk7XG5cbiAgICAvL3N0YXJ0IHRvIGZpbGwgdGhlIGJ1ZmZlclxuICAgIHNvdXJjZVN0cmVhbS5wdWxsKGJ1ZmZlci5sZW5ndGgsIGJ1ZmZlclNpemUgLSBidWZmZXIubGVuZ3RoKVxuICAgICAgLnRoZW4oaXRlbXMgPT4ge1xuICAgICAgICBidWZmZXIucHVzaCguLi5pdGVtcy5tYXAocm93RmFjdG9yeSkpO1xuICAgICAgICBpZiAoY29udGFpbmVySW50ZXJmYWNlLmxlbmd0aCA8IHdpbmRvd1NpemUpIHtcbiAgICAgICAgICBjb250YWluZXJJbnRlcmZhY2UuZW1wdHkoKTtcbiAgICAgICAgICBjb25zdCB7c2xpY2U6bm9kZXN9ID0gYnVmZmVyLnNsaWRlKDApO1xuICAgICAgICAgIGNvbnRhaW5lckludGVyZmFjZS5hcHBlbmQoLi4ubm9kZXMubWFwKG4gPT4gbi5kb20oKSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfSk7XG59IiwiaW1wb3J0IHRhYmxlIGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuaW1wb3J0IHZpcnR1YWxpemVyIGZyb20gJy4uL2luZGV4JztcblxuZnVuY3Rpb24gcm93RmFjdG9yeSAoaXRlbSkge1xuICBjb25zdCB7aW5kZXgsIHZhbHVlfSA9IGl0ZW07XG4gIGNvbnN0IGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnVFInKTtcbiAgbGkuaW5uZXJIVE1MID0gYDx0ZD4ke3ZhbHVlLmlkfTwvdGQ+PHRkPiR7aW5kZXh9PC90ZD5gO1xuICByZXR1cm4ge1xuICAgIGRvbSgpe1xuICAgICAgcmV0dXJuIGxpO1xuICAgIH0sXG4gICAgY2xlYW4oKXtcbiAgICB9XG4gIH1cbn1cblxuY29uc3QgZGF0YSA9IFtdO1xuXG5mb3IgKGxldCBpID0gMTsgaSA8PSAxMDAwMDsgaSsrKSB7XG4gIGRhdGEucHVzaCh7aWQ6IGl9KTtcbn1cblxuY29uc3QgdCA9IHRhYmxlKHtcbiAgZGF0YSxcbiAgdGFibGVTdGF0ZToge3NvcnQ6IHt9LCBmaWx0ZXI6IHt9LCBzbGljZToge3BhZ2U6IDEsIHNpemU6IDUwfX1cbn0pO1xuXG5jb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCd0Ym9keScpOyAvL2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb250YWluZXInKTtcblxudmlydHVhbGl6ZXIoe1xuICB0YWJsZTogdCxcbiAgcm93RmFjdG9yeSxcbiAgY29udGFpbmVyLFxuICAvLyBidWZmZXJTaXplOiAxMDAwLFxuICAvLyB3aW5kb3dTaXplOiAyMDAsXG4gIHRyZXNob2xkOiAwLjdcbn0pO1xuXG50LmV4ZWMoKTsiXSwibmFtZXMiOlsicG9pbnRlciIsImZpbHRlciIsInNvcnRGYWN0b3J5Iiwic29ydCIsInNlYXJjaCIsInRhYmxlIiwiY3VycnkiXSwibWFwcGluZ3MiOiI7OztBQUFPLFNBQVMsSUFBSSxFQUFFLENBQUMsRUFBRTtFQUN2QixPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0NBQzFCOztBQUVELEFBQU8sU0FBUyxPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsR0FBRyxFQUFFO0VBQ3RDLE9BQU8sQ0FBQyxHQUFHLElBQUks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

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

const container = document.querySelector('tbody');

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zb3J0L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWZpbHRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zZWFyY2gvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZXZlbnRzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2V2ZW50cy5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLW9wZXJhdG9ycy9pbmRleC5qcyIsIi4uL2xpYi9oZWxwZXIuanMiLCIuLi9saWIvZGF0YVNvdXJjZS5qcyIsIi4uL2xpYi9idWZmZXJlZFdpbmRvdy5qcyIsIi4uL2xpYi9jb250YWluZXIuanMiLCIuLi9pbmRleC5qcyIsImluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHBvaW50ZXIgKHBhdGgpIHtcblxuICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcblxuICBmdW5jdGlvbiBwYXJ0aWFsIChvYmogPSB7fSwgcGFydHMgPSBbXSkge1xuICAgIGNvbnN0IHAgPSBwYXJ0cy5zaGlmdCgpO1xuICAgIGNvbnN0IGN1cnJlbnQgPSBvYmpbcF07XG4gICAgcmV0dXJuIChjdXJyZW50ID09PSB1bmRlZmluZWQgfHwgcGFydHMubGVuZ3RoID09PSAwKSA/XG4gICAgICBjdXJyZW50IDogcGFydGlhbChjdXJyZW50LCBwYXJ0cyk7XG4gIH1cblxuICBmdW5jdGlvbiBzZXQgKHRhcmdldCwgbmV3VHJlZSkge1xuICAgIGxldCBjdXJyZW50ID0gdGFyZ2V0O1xuICAgIGNvbnN0IFtsZWFmLCAuLi5pbnRlcm1lZGlhdGVdID0gcGFydHMucmV2ZXJzZSgpO1xuICAgIGZvciAobGV0IGtleSBvZiBpbnRlcm1lZGlhdGUucmV2ZXJzZSgpKSB7XG4gICAgICBpZiAoY3VycmVudFtrZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY3VycmVudFtrZXldID0ge307XG4gICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIGN1cnJlbnRbbGVhZl0gPSBPYmplY3QuYXNzaWduKGN1cnJlbnRbbGVhZl0gfHwge30sIG5ld1RyZWUpO1xuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGdldCh0YXJnZXQpe1xuICAgICAgcmV0dXJuIHBhcnRpYWwodGFyZ2V0LCBbLi4ucGFydHNdKVxuICAgIH0sXG4gICAgc2V0XG4gIH1cbn07XG4iLCJpbXBvcnQge3N3YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5cbmZ1bmN0aW9uIHNvcnRCeVByb3BlcnR5IChwcm9wKSB7XG4gIGNvbnN0IHByb3BHZXR0ZXIgPSBwb2ludGVyKHByb3ApLmdldDtcbiAgcmV0dXJuIChhLCBiKSA9PiB7XG4gICAgY29uc3QgYVZhbCA9IHByb3BHZXR0ZXIoYSk7XG4gICAgY29uc3QgYlZhbCA9IHByb3BHZXR0ZXIoYik7XG5cbiAgICBpZiAoYVZhbCA9PT0gYlZhbCkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgaWYgKGJWYWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cblxuICAgIGlmIChhVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIHJldHVybiBhVmFsIDwgYlZhbCA/IC0xIDogMTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzb3J0RmFjdG9yeSAoe3BvaW50ZXIsIGRpcmVjdGlvbn0gPSB7fSkge1xuICBpZiAoIXBvaW50ZXIgfHwgZGlyZWN0aW9uID09PSAnbm9uZScpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gWy4uLmFycmF5XTtcbiAgfVxuXG4gIGNvbnN0IG9yZGVyRnVuYyA9IHNvcnRCeVByb3BlcnR5KHBvaW50ZXIpO1xuICBjb25zdCBjb21wYXJlRnVuYyA9IGRpcmVjdGlvbiA9PT0gJ2Rlc2MnID8gc3dhcChvcmRlckZ1bmMpIDogb3JkZXJGdW5jO1xuXG4gIHJldHVybiAoYXJyYXkpID0+IFsuLi5hcnJheV0uc29ydChjb21wYXJlRnVuYyk7XG59IiwiaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZnVuY3Rpb24gdHlwZUV4cHJlc3Npb24gKHR5cGUpIHtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gQm9vbGVhbjtcbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuIE51bWJlcjtcbiAgICBjYXNlICdkYXRlJzpcbiAgICAgIHJldHVybiAodmFsKSA9PiBuZXcgRGF0ZSh2YWwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gY29tcG9zZShTdHJpbmcsICh2YWwpID0+IHZhbC50b0xvd2VyQ2FzZSgpKTtcbiAgfVxufVxuXG5jb25zdCBvcGVyYXRvcnMgPSB7XG4gIGluY2x1ZGVzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dC5pbmNsdWRlcyh2YWx1ZSk7XG4gIH0sXG4gIGlzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgaXNOb3QodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+ICFPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgbHQodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDwgdmFsdWU7XG4gIH0sXG4gIGd0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+IHZhbHVlO1xuICB9LFxuICBsdGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDw9IHZhbHVlO1xuICB9LFxuICBndGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0ID49IHZhbHVlO1xuICB9LFxuICBlcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlID09IGlucHV0O1xuICB9LFxuICBub3RFcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlICE9IGlucHV0O1xuICB9XG59O1xuXG5jb25zdCBldmVyeSA9IGZucyA9PiAoLi4uYXJncykgPT4gZm5zLmV2ZXJ5KGZuID0+IGZuKC4uLmFyZ3MpKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHByZWRpY2F0ZSAoe3ZhbHVlID0gJycsIG9wZXJhdG9yID0gJ2luY2x1ZGVzJywgdHlwZSA9ICdzdHJpbmcnfSkge1xuICBjb25zdCB0eXBlSXQgPSB0eXBlRXhwcmVzc2lvbih0eXBlKTtcbiAgY29uc3Qgb3BlcmF0ZU9uVHlwZWQgPSBjb21wb3NlKHR5cGVJdCwgb3BlcmF0b3JzW29wZXJhdG9yXSk7XG4gIGNvbnN0IHByZWRpY2F0ZUZ1bmMgPSBvcGVyYXRlT25UeXBlZCh2YWx1ZSk7XG4gIHJldHVybiBjb21wb3NlKHR5cGVJdCwgcHJlZGljYXRlRnVuYyk7XG59XG5cbi8vYXZvaWQgdXNlbGVzcyBmaWx0ZXIgbG9va3VwIChpbXByb3ZlIHBlcmYpXG5mdW5jdGlvbiBub3JtYWxpemVDbGF1c2VzIChjb25mKSB7XG4gIGNvbnN0IG91dHB1dCA9IHt9O1xuICBjb25zdCB2YWxpZFBhdGggPSBPYmplY3Qua2V5cyhjb25mKS5maWx0ZXIocGF0aCA9PiBBcnJheS5pc0FycmF5KGNvbmZbcGF0aF0pKTtcbiAgdmFsaWRQYXRoLmZvckVhY2gocGF0aCA9PiB7XG4gICAgY29uc3QgdmFsaWRDbGF1c2VzID0gY29uZltwYXRoXS5maWx0ZXIoYyA9PiBjLnZhbHVlICE9PSAnJyk7XG4gICAgaWYgKHZhbGlkQ2xhdXNlcy5sZW5ndGgpIHtcbiAgICAgIG91dHB1dFtwYXRoXSA9IHZhbGlkQ2xhdXNlcztcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmaWx0ZXIgKGZpbHRlcikge1xuICBjb25zdCBub3JtYWxpemVkQ2xhdXNlcyA9IG5vcm1hbGl6ZUNsYXVzZXMoZmlsdGVyKTtcbiAgY29uc3QgZnVuY0xpc3QgPSBPYmplY3Qua2V5cyhub3JtYWxpemVkQ2xhdXNlcykubWFwKHBhdGggPT4ge1xuICAgIGNvbnN0IGdldHRlciA9IHBvaW50ZXIocGF0aCkuZ2V0O1xuICAgIGNvbnN0IGNsYXVzZXMgPSBub3JtYWxpemVkQ2xhdXNlc1twYXRoXS5tYXAocHJlZGljYXRlKTtcbiAgICByZXR1cm4gY29tcG9zZShnZXR0ZXIsIGV2ZXJ5KGNsYXVzZXMpKTtcbiAgfSk7XG4gIGNvbnN0IGZpbHRlclByZWRpY2F0ZSA9IGV2ZXJ5KGZ1bmNMaXN0KTtcblxuICByZXR1cm4gKGFycmF5KSA9PiBhcnJheS5maWx0ZXIoZmlsdGVyUHJlZGljYXRlKTtcbn0iLCJpbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc2VhcmNoQ29uZiA9IHt9KSB7XG4gIGNvbnN0IHt2YWx1ZSwgc2NvcGUgPSBbXX0gPSBzZWFyY2hDb25mO1xuICBjb25zdCBzZWFyY2hQb2ludGVycyA9IHNjb3BlLm1hcChmaWVsZCA9PiBwb2ludGVyKGZpZWxkKS5nZXQpO1xuICBpZiAoIXNjb3BlLmxlbmd0aCB8fCAhdmFsdWUpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gYXJyYXk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5LmZpbHRlcihpdGVtID0+IHNlYXJjaFBvaW50ZXJzLnNvbWUocCA9PiBTdHJpbmcocChpdGVtKSkuaW5jbHVkZXMoU3RyaW5nKHZhbHVlKSkpKVxuICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc2xpY2VGYWN0b3J5ICh7cGFnZSA9IDEsIHNpemV9ID0ge30pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHNsaWNlRnVuY3Rpb24gKGFycmF5ID0gW10pIHtcbiAgICBjb25zdCBhY3R1YWxTaXplID0gc2l6ZSB8fCBhcnJheS5sZW5ndGg7XG4gICAgY29uc3Qgb2Zmc2V0ID0gKHBhZ2UgLSAxKSAqIGFjdHVhbFNpemU7XG4gICAgcmV0dXJuIGFycmF5LnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgYWN0dWFsU2l6ZSk7XG4gIH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZW1pdHRlciAoKSB7XG5cbiAgY29uc3QgbGlzdGVuZXJzTGlzdHMgPSB7fTtcblxuICByZXR1cm4ge1xuICAgIG9uKGV2ZW50LCAuLi5saXN0ZW5lcnMpe1xuICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gKGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXSkuY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGRpc3BhdGNoKGV2ZW50LCAuLi5hcmdzKXtcbiAgICAgIGNvbnN0IGxpc3RlbmVycyA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIGxpc3RlbmVycykge1xuICAgICAgICBsaXN0ZW5lciguLi5hcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgb2ZmKGV2ZW50LCAuLi5saXN0ZW5lcnMpe1xuICAgICAgaWYgKCFldmVudCkge1xuICAgICAgICBPYmplY3Qua2V5cyhsaXN0ZW5lcnNMaXN0cykuZm9yRWFjaChldiA9PiB0aGlzLm9mZihldikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gbGlzdGVuZXJzLmxlbmd0aCA/IGxpc3QuZmlsdGVyKGxpc3RlbmVyID0+ICFsaXN0ZW5lcnMuaW5jbHVkZXMobGlzdGVuZXIpKSA6IFtdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm94eUxpc3RlbmVyIChldmVudE1hcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKHtlbWl0dGVyfSkge1xuXG4gICAgY29uc3QgcHJveHkgPSB7fTtcbiAgICBsZXQgZXZlbnRMaXN0ZW5lcnMgPSB7fTtcblxuICAgIGZvciAobGV0IGV2IG9mIE9iamVjdC5rZXlzKGV2ZW50TWFwKSkge1xuICAgICAgY29uc3QgbWV0aG9kID0gZXZlbnRNYXBbZXZdO1xuICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gW107XG4gICAgICBwcm94eVttZXRob2RdID0gZnVuY3Rpb24gKC4uLmxpc3RlbmVycykge1xuICAgICAgICBldmVudExpc3RlbmVyc1tldl0gPSBldmVudExpc3RlbmVyc1tldl0uY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICAgIGVtaXR0ZXIub24oZXYsIC4uLmxpc3RlbmVycyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihwcm94eSwge1xuICAgICAgb2ZmKGV2KXtcbiAgICAgICAgaWYgKCFldikge1xuICAgICAgICAgIE9iamVjdC5rZXlzKGV2ZW50TGlzdGVuZXJzKS5mb3JFYWNoKGV2ZW50TmFtZSA9PiB0aGlzLm9mZihldmVudE5hbWUpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudExpc3RlbmVyc1tldl0pIHtcbiAgICAgICAgICBlbWl0dGVyLm9mZihldiwgLi4uZXZlbnRMaXN0ZW5lcnNbZXZdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59IiwiZXhwb3J0IGNvbnN0IFRPR0dMRV9TT1JUID0gJ1RPR0dMRV9TT1JUJztcbmV4cG9ydCBjb25zdCBESVNQTEFZX0NIQU5HRUQgPSAnRElTUExBWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBQQUdFX0NIQU5HRUQgPSAnQ0hBTkdFX1BBR0UnO1xuZXhwb3J0IGNvbnN0IEVYRUNfQ0hBTkdFRCA9ICdFWEVDX1NUQVJURUQnO1xuZXhwb3J0IGNvbnN0IEZJTFRFUl9DSEFOR0VEID0gJ0ZJTFRFUl9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTVU1NQVJZX0NIQU5HRUQgPSAnU1VNTUFSWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTRUFSQ0hfQ0hBTkdFRCA9ICdTRUFSQ0hfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRVhFQ19FUlJPUiA9ICdFWEVDX0VSUk9SJzsiLCJpbXBvcnQgc2xpY2UgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtjdXJyeSwgdGFwLCBjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcbmltcG9ydCB7ZW1pdHRlcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcbmltcG9ydCBzbGljZUZhY3RvcnkgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtcbiAgU1VNTUFSWV9DSEFOR0VELFxuICBUT0dHTEVfU09SVCxcbiAgRElTUExBWV9DSEFOR0VELFxuICBQQUdFX0NIQU5HRUQsXG4gIEVYRUNfQ0hBTkdFRCxcbiAgRklMVEVSX0NIQU5HRUQsXG4gIFNFQVJDSF9DSEFOR0VELFxuICBFWEVDX0VSUk9SXG59IGZyb20gJy4uL2V2ZW50cyc7XG5cbmZ1bmN0aW9uIGN1cnJpZWRQb2ludGVyIChwYXRoKSB7XG4gIGNvbnN0IHtnZXQsIHNldH0gPSBwb2ludGVyKHBhdGgpO1xuICByZXR1cm4ge2dldCwgc2V0OiBjdXJyeShzZXQpfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtcbiAgc29ydEZhY3RvcnksXG4gIHRhYmxlU3RhdGUsXG4gIGRhdGEsXG4gIGZpbHRlckZhY3RvcnksXG4gIHNlYXJjaEZhY3Rvcnlcbn0pIHtcbiAgY29uc3QgdGFibGUgPSBlbWl0dGVyKCk7XG4gIGNvbnN0IHNvcnRQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NvcnQnKTtcbiAgY29uc3Qgc2xpY2VQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NsaWNlJyk7XG4gIGNvbnN0IGZpbHRlclBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignZmlsdGVyJyk7XG4gIGNvbnN0IHNlYXJjaFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2VhcmNoJyk7XG5cbiAgY29uc3Qgc2FmZUFzc2lnbiA9IGN1cnJ5KChiYXNlLCBleHRlbnNpb24pID0+IE9iamVjdC5hc3NpZ24oe30sIGJhc2UsIGV4dGVuc2lvbikpO1xuICBjb25zdCBkaXNwYXRjaCA9IGN1cnJ5KHRhYmxlLmRpc3BhdGNoLmJpbmQodGFibGUpLCAyKTtcblxuICBjb25zdCBjcmVhdGVTdW1tYXJ5ID0gKGZpbHRlcmVkKSA9PiB7XG4gICAgZGlzcGF0Y2goU1VNTUFSWV9DSEFOR0VELCB7XG4gICAgICBwYWdlOiB0YWJsZVN0YXRlLnNsaWNlLnBhZ2UsXG4gICAgICBzaXplOiB0YWJsZVN0YXRlLnNsaWNlLnNpemUsXG4gICAgICBmaWx0ZXJlZENvdW50OiBmaWx0ZXJlZC5sZW5ndGhcbiAgICB9KTtcbiAgfTtcblxuICBjb25zdCBleGVjID0gKHtwcm9jZXNzaW5nRGVsYXkgPSAyMH0gPSB7fSkgPT4ge1xuICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfQ0hBTkdFRCwge3dvcmtpbmc6IHRydWV9KTtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc2VhcmNoRnVuYyA9IHNlYXJjaEZhY3Rvcnkoc2VhcmNoUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzb3J0RnVuYyA9IHNvcnRGYWN0b3J5KHNvcnRQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNsaWNlRnVuYyA9IHNsaWNlRmFjdG9yeShzbGljZVBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3QgZXhlY0Z1bmMgPSBjb21wb3NlKGZpbHRlckZ1bmMsIHNlYXJjaEZ1bmMsIHRhcChjcmVhdGVTdW1tYXJ5KSwgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgIGNvbnN0IGRpc3BsYXllZCA9IGV4ZWNGdW5jKGRhdGEpO1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChESVNQTEFZX0NIQU5HRUQsIGRpc3BsYXllZC5tYXAoZCA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH07XG4gICAgICAgIH0pKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19FUlJPUiwgZSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiBmYWxzZX0pO1xuICAgICAgfVxuICAgIH0sIHByb2Nlc3NpbmdEZWxheSk7XG4gIH07XG5cbiAgY29uc3QgdXBkYXRlVGFibGVTdGF0ZSA9IGN1cnJ5KChwdGVyLCBldiwgbmV3UGFydGlhbFN0YXRlKSA9PiBjb21wb3NlKFxuICAgIHNhZmVBc3NpZ24ocHRlci5nZXQodGFibGVTdGF0ZSkpLFxuICAgIHRhcChkaXNwYXRjaChldikpLFxuICAgIHB0ZXIuc2V0KHRhYmxlU3RhdGUpXG4gICkobmV3UGFydGlhbFN0YXRlKSk7XG5cbiAgY29uc3QgcmVzZXRUb0ZpcnN0UGFnZSA9ICgpID0+IHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQsIHtwYWdlOiAxfSk7XG5cbiAgY29uc3QgdGFibGVPcGVyYXRpb24gPSAocHRlciwgZXYpID0+IGNvbXBvc2UoXG4gICAgdXBkYXRlVGFibGVTdGF0ZShwdGVyLCBldiksXG4gICAgcmVzZXRUb0ZpcnN0UGFnZSxcbiAgICAoKSA9PiB0YWJsZS5leGVjKCkgLy8gd2Ugd3JhcCB3aXRoaW4gYSBmdW5jdGlvbiBzbyB0YWJsZS5leGVjIGNhbiBiZSBvdmVyd3JpdHRlbiAod2hlbiB1c2luZyB3aXRoIGEgc2VydmVyIGZvciBleGFtcGxlKVxuICApO1xuXG4gIGNvbnN0IGFwaSA9IHtcbiAgICBzb3J0OiB0YWJsZU9wZXJhdGlvbihzb3J0UG9pbnRlciwgVE9HR0xFX1NPUlQpLFxuICAgIGZpbHRlcjogdGFibGVPcGVyYXRpb24oZmlsdGVyUG9pbnRlciwgRklMVEVSX0NIQU5HRUQpLFxuICAgIHNlYXJjaDogdGFibGVPcGVyYXRpb24oc2VhcmNoUG9pbnRlciwgU0VBUkNIX0NIQU5HRUQpLFxuICAgIHNsaWNlOiBjb21wb3NlKHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQpLCAoKSA9PiB0YWJsZS5leGVjKCkpLFxuICAgIGV4ZWMsXG4gICAgZXZhbChzdGF0ZSA9IHRhYmxlU3RhdGUpe1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBjb25zdCBzb3J0RnVuYyA9IHNvcnRGYWN0b3J5KHNvcnRQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCBzb3J0RnVuYywgc2xpY2VGdW5jKTtcbiAgICAgICAgICByZXR1cm4gZXhlY0Z1bmMoZGF0YSkubWFwKGQgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBvbkRpc3BsYXlDaGFuZ2UoZm4pe1xuICAgICAgdGFibGUub24oRElTUExBWV9DSEFOR0VELCBmbik7XG4gICAgfSxcbiAgICBnZXRUYWJsZVN0YXRlKCl7XG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZSlcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24odGFibGUsIGFwaSk7XG59IiwiaW1wb3J0IHNvcnQgZnJvbSAnc21hcnQtdGFibGUtc29ydCc7XG5pbXBvcnQgZmlsdGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWZpbHRlcic7XG5pbXBvcnQgc2VhcmNoIGZyb20gJ3NtYXJ0LXRhYmxlLXNlYXJjaCc7XG5pbXBvcnQgdGFibGUgZnJvbSAnLi9kaXJlY3RpdmVzL3RhYmxlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtcbiAgc29ydEZhY3RvcnkgPSBzb3J0LFxuICBmaWx0ZXJGYWN0b3J5ID0gZmlsdGVyLFxuICBzZWFyY2hGYWN0b3J5ID0gc2VhcmNoLFxuICB0YWJsZVN0YXRlID0ge3NvcnQ6IHt9LCBzbGljZToge3BhZ2U6IDF9LCBmaWx0ZXI6IHt9LCBzZWFyY2g6IHt9fSxcbiAgZGF0YSA9IFtdXG59LCAuLi50YWJsZURpcmVjdGl2ZXMpIHtcblxuICBjb25zdCBjb3JlVGFibGUgPSB0YWJsZSh7c29ydEZhY3RvcnksIGZpbHRlckZhY3RvcnksIHRhYmxlU3RhdGUsIGRhdGEsIHNlYXJjaEZhY3Rvcnl9KTtcblxuICByZXR1cm4gdGFibGVEaXJlY3RpdmVzLnJlZHVjZSgoYWNjdW11bGF0b3IsIG5ld2RpcikgPT4ge1xuICAgIHJldHVybiBPYmplY3QuYXNzaWduKGFjY3VtdWxhdG9yLCBuZXdkaXIoe1xuICAgICAgc29ydEZhY3RvcnksXG4gICAgICBmaWx0ZXJGYWN0b3J5LFxuICAgICAgc2VhcmNoRmFjdG9yeSxcbiAgICAgIHRhYmxlU3RhdGUsXG4gICAgICBkYXRhLFxuICAgICAgdGFibGU6IGNvcmVUYWJsZVxuICAgIH0pKTtcbiAgfSwgY29yZVRhYmxlKTtcbn0iLCJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJpbXBvcnQge2N1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5leHBvcnQgZnVuY3Rpb24qIGdpdmVNZU4gKG4pIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyBpKyspIHtcbiAgICB5aWVsZCBpO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBkb05UaW1lcyA9IGN1cnJ5KChmbiwgY291bnQgPSAxKSA9PiB7XG4gIGNvbnN0IG4gPSBjb3VudCB8fCAxO1xuICBbLi4uZ2l2ZU1lTihuKV0uZm9yRWFjaCgoKSA9PiBmbigpKTtcbn0sIDIpO1xuIiwiaW1wb3J0IHtnaXZlTWVOfSBmcm9tICcuL2hlbHBlcic7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGV9KSB7XG4gIHJldHVybiB7XG4gICAgcHVsbChvZmZzZXQsIG51bWJlcil7XG4gICAgICBjb25zdCB0YWJsZVN0YXRlID0gdGFibGUuZ2V0VGFibGVTdGF0ZSgpO1xuICAgICAgY29uc3Qge3NsaWNlOntzaXplOnBhZ2VTaXplfX0gPSB0YWJsZVN0YXRlO1xuICAgICAgY29uc3Qgc3RhcnRQYWdlID0gTWF0aC5mbG9vcihvZmZzZXQgLyBwYWdlU2l6ZSk7XG4gICAgICBjb25zdCB0cmltQmVmb3JlID0gb2Zmc2V0ICUgcGFnZVNpemU7XG4gICAgICBjb25zdCBsYXN0UGFnZSA9IE1hdGguY2VpbCgob2Zmc2V0ICsgbnVtYmVyKSAvIHBhZ2VTaXplKTtcbiAgICAgIGNvbnN0IHBhZ2VDb25mTGlzdCA9IFsuLi5naXZlTWVOKGxhc3RQYWdlIC0gc3RhcnRQYWdlKV0ubWFwKG9mZiA9PiAoe1xuICAgICAgICBwYWdlOiBzdGFydFBhZ2UgKyBvZmYgKyAxLFxuICAgICAgICBzaXplOiBwYWdlU2l6ZVxuICAgICAgfSkpO1xuICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHBhZ2VDb25mTGlzdC5tYXAoc2xpY2UgPT4ge1xuICAgICAgICByZXR1cm4gdGFibGUuZXZhbChPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLCB7c2xpY2V9KSk7XG4gICAgICB9LCBbXSkpXG4gICAgICAgIC50aGVuKHBhZ2VzID0+IHtcbiAgICAgICAgICByZXR1cm4gcGFnZXMucmVkdWNlKChhY2MsIGN1cnIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhY2MuY29uY2F0KGN1cnIpO1xuICAgICAgICAgIH0sIFtdKVxuICAgICAgICAgICAgLmZpbHRlcigoaXRlbSwgaW5kZXgpID0+IGluZGV4ID49IHRyaW1CZWZvcmUpXG4gICAgICAgICAgICAuc2xpY2UoMCwgbnVtYmVyKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICB9O1xufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7YnVmZmVyU2l6ZSA9IDEwMDAsIHdpbmRvd1NpemUgPSAyMDB9ID0ge30pIHtcblxuICBjb25zdCBkYXRhTGlzdCA9IFtdO1xuICBsZXQgd2luZG93Q3Vyc29yID0gbnVsbDtcblxuICBjb25zdCBpbnN0YW5jZSA9IHtcbiAgICBwdXNoKCl7XG4gICAgICBjb25zdCBpdGVtcyA9IFsuLi5hcmd1bWVudHNdO1xuICAgICAgY29uc3QgbWF4UmVtb3ZhYmxlSXRlbUNvdW50ID0gTWF0aC5taW4oZGF0YUxpc3QuaW5kZXhPZih3aW5kb3dDdXJzb3IpLCBpdGVtcy5sZW5ndGgpO1xuICAgICAgY29uc3QgbGltaXQgPSBkYXRhTGlzdC5sZW5ndGggPCBidWZmZXJTaXplID8gYnVmZmVyU2l6ZSAtIGRhdGFMaXN0Lmxlbmd0aCA6IG1heFJlbW92YWJsZUl0ZW1Db3VudDtcbiAgICAgIGNvbnN0IHRvQXBwZW5kID0gaXRlbXMuc2xpY2UoMCwgbGltaXQpO1xuICAgICAgY29uc3QgdGFpbEl0ZW0gPSBpbnN0YW5jZS50YWlsKCk7XG4gICAgICBjb25zdCBzdGFydEluZGV4ID0gdGFpbEl0ZW0gPyB0YWlsSXRlbS4kJGluZGV4ICsgMSA6IDA7XG4gICAgICBkYXRhTGlzdC5wdXNoKC4uLnRvQXBwZW5kLm1hcCgoaXRlbSwgb2Zmc2V0KSA9PiBPYmplY3QuYXNzaWduKHskJGluZGV4OiBzdGFydEluZGV4ICsgb2Zmc2V0fSwgaXRlbSkpKTtcbiAgICAgIGlmIChkYXRhTGlzdC5sZW5ndGggPiBidWZmZXJTaXplKSB7XG4gICAgICAgIGNvbnN0IHRvRHJvcCA9IGRhdGFMaXN0LnNwbGljZSgwLCBsaW1pdCk7XG4gICAgICAgIHRvRHJvcC5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgICAgIGlmIChpdGVtLmNsZWFuKSB7XG4gICAgICAgICAgICBpdGVtLmNsZWFuKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHVuc2hpZnQoKXtcbiAgICAgIGNvbnN0IGl0ZW1zID0gWy4uLmFyZ3VtZW50c107XG4gICAgICBjb25zdCB1cHBlcldpbmRvd0luZGV4ID0gTWF0aC5taW4oZGF0YUxpc3QuaW5kZXhPZih3aW5kb3dDdXJzb3IpICsgd2luZG93U2l6ZSwgZGF0YUxpc3QubGVuZ3RoIC0gMSk7XG4gICAgICBjb25zdCBtYXhSZW1vdmFibGVJdGVtQ291bnQgPSBNYXRoLm1pbihkYXRhTGlzdC5sZW5ndGggLSB1cHBlcldpbmRvd0luZGV4LCBpdGVtcy5sZW5ndGgpO1xuICAgICAgY29uc3QgbGltaXQgPSBkYXRhTGlzdC5sZW5ndGggPCBidWZmZXJTaXplID8gYnVmZmVyU2l6ZSAtIGRhdGFMaXN0Lmxlbmd0aCA6IG1heFJlbW92YWJsZUl0ZW1Db3VudDtcbiAgICAgIGNvbnN0IHRvUHJlcGVuZCA9IGl0ZW1zLnNsaWNlKDAsIGxpbWl0KTtcbiAgICAgIGNvbnN0IHN0YXJ0SW5kZXggPSBpbnN0YW5jZS5oZWFkKCkuJCRpbmRleCAtIGxpbWl0O1xuICAgICAgZGF0YUxpc3QudW5zaGlmdCguLi50b1ByZXBlbmQubWFwKChpdGVtLCBvZmZzZXQpID0+IE9iamVjdC5hc3NpZ24oeyQkaW5kZXg6IHN0YXJ0SW5kZXggKyBvZmZzZXR9LCBpdGVtKSkpO1xuICAgICAgaWYgKGRhdGFMaXN0Lmxlbmd0aCA+IGJ1ZmZlclNpemUpIHtcbiAgICAgICAgY29uc3QgdG9Ecm9wID0gZGF0YUxpc3Quc3BsaWNlKC1saW1pdCk7XG4gICAgICAgIHRvRHJvcC5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgICAgIGlmIChpdGVtLmNsZWFuKSB7XG4gICAgICAgICAgICBpdGVtLmNsZWFuKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGdldChpbmRleCl7XG4gICAgICByZXR1cm4gZGF0YUxpc3QuZmluZChpdGVtID0+IGl0ZW0uJCRpbmRleCA9PT0gaW5kZXgpO1xuICAgIH0sXG4gICAgaGVhZCgpe1xuICAgICAgcmV0dXJuIGRhdGFMaXN0WzBdIHx8IG51bGw7XG4gICAgfSxcbiAgICB0YWlsKCl7XG4gICAgICByZXR1cm4gZGF0YUxpc3QubGVuZ3RoID8gZGF0YUxpc3RbZGF0YUxpc3QubGVuZ3RoIC0gMV0gOiBudWxsO1xuICAgIH0sXG4gICAgc2xpZGUob2Zmc2V0KXtcbiAgICAgIGNvbnN0IGN1cnNvckluZGV4ID0gd2luZG93Q3Vyc29yICE9PSBudWxsID8gZGF0YUxpc3QuaW5kZXhPZih3aW5kb3dDdXJzb3IpIDogMDtcbiAgICAgIGNvbnN0IGluZGV4ID0gTWF0aC5tYXgoY3Vyc29ySW5kZXggKyBvZmZzZXQsIDApO1xuICAgICAgY29uc3Qgc3RhcnQgPSBpbmRleCArIHdpbmRvd1NpemUgPj0gKGJ1ZmZlclNpemUgLSAxKSA/IGJ1ZmZlclNpemUgLSB3aW5kb3dTaXplIDogaW5kZXg7XG4gICAgICBjb25zdCBzbGljZSA9IGRhdGFMaXN0LnNsaWNlKHN0YXJ0LCBzdGFydCArIHdpbmRvd1NpemUpO1xuICAgICAgY29uc3Qgc2hpZnQgPSBzdGFydCAtIGN1cnNvckluZGV4O1xuICAgICAgd2luZG93Q3Vyc29yID0gZGF0YUxpc3Rbc3RhcnRdO1xuICAgICAgcmV0dXJuIHtzbGljZSwgc2hpZnR9O1xuICAgIH0sXG4gICAgcG9zaXRpb24oKXtcbiAgICAgIHJldHVybiAoZGF0YUxpc3QuaW5kZXhPZih3aW5kb3dDdXJzb3IpICsgMSkgLyAoYnVmZmVyU2l6ZSAtIHdpbmRvd1NpemUpO1xuICAgIH1cbiAgfTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoaW5zdGFuY2UsICdsZW5ndGgnLCB7XG4gICAgZ2V0KCl7XG4gICAgICByZXR1cm4gZGF0YUxpc3QubGVuZ3RoO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufSIsImltcG9ydCB7ZG9OVGltZXN9IGZyb20gJy4vaGVscGVyJ1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2VsZW1lbnQsIHdpbmRvd1NpemV9KSB7XG5cbiAgY29uc3QgaW5zdGFuY2UgPSB7XG4gICAgYXBwZW5kKC4uLmFyZ3Mpe1xuICAgICAgZm9yIChsZXQgaXRlbSBvZiBhcmdzKSB7XG4gICAgICAgIGVsZW1lbnQuYXBwZW5kQ2hpbGQoaXRlbSk7XG4gICAgICAgIGlmIChpbnN0YW5jZS5sZW5ndGggPiB3aW5kb3dTaXplKSB7XG4gICAgICAgICAgaW5zdGFuY2UuZHJvcEJlZ2luKGluc3RhbmNlLmxlbmd0aCAtIHdpbmRvd1NpemUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBwcmVwZW5kKC4uLmFyZ3Mpe1xuICAgICAgZm9yIChsZXQgaXRlbSBvZiBhcmdzKSB7XG4gICAgICAgIGVsZW1lbnQuaW5zZXJ0QmVmb3JlKGl0ZW0sIGVsZW1lbnQuZmlyc3RDaGlsZCk7XG4gICAgICAgIGlmIChpbnN0YW5jZS5sZW5ndGggPiB3aW5kb3dTaXplKSB7XG4gICAgICAgICAgaW5zdGFuY2UuZHJvcEVuZChpbnN0YW5jZS5sZW5ndGggLSB3aW5kb3dTaXplKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgZHJvcEJlZ2luOiBkb05UaW1lcygoKSA9PiB7XG4gICAgICBjb25zdCBmaXJzdENoaWxkID0gZWxlbWVudC5maXJzdENoaWxkO1xuICAgICAgaWYgKGZpcnN0Q2hpbGQpIHtcbiAgICAgICAgZmlyc3RDaGlsZC5yZW1vdmUoKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICBkcm9wRW5kOiBkb05UaW1lcygoKSA9PiB7XG4gICAgICBjb25zdCBsYXN0Q2hpbGQgPSBlbGVtZW50Lmxhc3RDaGlsZDtcbiAgICAgIGlmIChsYXN0Q2hpbGQpIHtcbiAgICAgICAgbGFzdENoaWxkLnJlbW92ZSgpO1xuICAgICAgfVxuICAgIH0pLFxuICAgIGVtcHR5KCl7XG4gICAgICBlbGVtZW50LmlubmVySFRNTCA9ICcnO1xuICAgIH1cbiAgfTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoaW5zdGFuY2UsICdsZW5ndGgnLCB7XG4gICAgZ2V0KCl7XG4gICAgICByZXR1cm4gZWxlbWVudC5jaGlsZHJlbi5sZW5ndGg7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gaW5zdGFuY2U7XG59IiwiaW1wb3J0IGRhdGFTb3VyY2UgZnJvbSAnLi9saWIvZGF0YVNvdXJjZSc7XG5pbXBvcnQgYnVmZmVyZWRXaW5kb3cgZnJvbSAnLi9saWIvYnVmZmVyZWRXaW5kb3cnO1xuaW1wb3J0IGNvbnRhaW5lckZhY3RvcnkgZnJvbSAnLi9saWIvY29udGFpbmVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtjb250YWluZXIsIHRhYmxlLCByb3dGYWN0b3J5LCB3aW5kb3dTaXplID0gMjAwLCBidWZmZXJTaXplID0gMTAwMCwgdHJlc2hvbGQgPSAwLjh9KSB7XG4gIGxldCBzb3VyY2VTdHJlYW0gPSBudWxsO1xuICBsZXQgYnVmZmVyID0gbnVsbDtcbiAgbGV0IGZldGNoaW5nID0gZmFsc2U7XG4gIGxldCBsYXN0U2Nyb2xsO1xuICBsZXQgYW50ZUxhc3RTY3JvbGw7XG5cbiAgY29uc3QgYnVmZmVyUmVmcmVzaCA9IDAuNTtcbiAgY29uc3QgYnVmZmVyUmVmcmVzaFNpemUgPSBidWZmZXJSZWZyZXNoICogYnVmZmVyU2l6ZSAvIDI7XG5cbiAgY29uc3QgY29udGFpbmVySW50ZXJmYWNlID0gY29udGFpbmVyRmFjdG9yeSh7ZWxlbWVudDogY29udGFpbmVyLCB3aW5kb3dTaXplfSk7XG5cbiAgY29uc3Qgc2Nyb2xsRG93biA9IChzY3JvbGxSYXRpbykgPT4ge1xuICAgIGlmIChzY3JvbGxSYXRpbyA+IHRyZXNob2xkKSB7XG4gICAgICBjb25zdCB0b0FwcGVuZCA9IE1hdGguZmxvb3Iod2luZG93U2l6ZSAqICgxIC0gc2Nyb2xsUmF0aW8pKTtcbiAgICAgIGNvbnN0IHtzaGlmdCwgc2xpY2U6bm9kZXN9ID0gYnVmZmVyLnNsaWRlKHRvQXBwZW5kKTtcbiAgICAgIGlmIChzaGlmdCAhPT0gMCkge1xuICAgICAgICBjb250YWluZXJJbnRlcmZhY2UuYXBwZW5kKC4uLm5vZGVzLnNsaWNlKC1zaGlmdCkubWFwKG4gPT4gbi5kb20oKSkpO1xuICAgICAgfVxuICAgICAgY29uc3QgcG9zaXRpb24gPSBidWZmZXIucG9zaXRpb24oKTtcbiAgICAgIGlmIChwb3NpdGlvbiA+IGJ1ZmZlclJlZnJlc2ggJiYgZmV0Y2hpbmcgPT09IGZhbHNlKSB7XG4gICAgICAgIGNvbnN0IHRhaWxJbmRleCA9IGJ1ZmZlci50YWlsKCkuJCRpbmRleDtcbiAgICAgICAgZmV0Y2hpbmcgPSB0cnVlO1xuICAgICAgICBzb3VyY2VTdHJlYW0ucHVsbCh0YWlsSW5kZXggKyAxLCBidWZmZXJSZWZyZXNoU2l6ZSlcbiAgICAgICAgICAudGhlbihpdGVtcyA9PiB7XG4gICAgICAgICAgICBidWZmZXIucHVzaCguLi5pdGVtcy5tYXAocm93RmFjdG9yeSkpO1xuICAgICAgICAgICAgZmV0Y2hpbmcgPSBmYWxzZTtcbiAgICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgY29uc3Qgc2Nyb2xsVXAgPSAoc2Nyb2xsUmF0aW8pID0+IHtcbiAgICBpZiAoc2Nyb2xsUmF0aW8gPCAoMSAtIHRyZXNob2xkKSkge1xuICAgICAgY29uc3QgdG9QcmVwZW5kID0gTWF0aC5mbG9vcih3aW5kb3dTaXplICogKDEgLSB0cmVzaG9sZCkpO1xuICAgICAgY29uc3Qge3NoaWZ0LCBzbGljZTpub2Rlc30gPSBidWZmZXIuc2xpZGUoLXRvUHJlcGVuZCk7XG4gICAgICBpZiAoc2hpZnQgIT09IDApIHtcbiAgICAgICAgY29udGFpbmVySW50ZXJmYWNlLnByZXBlbmQoLi4ubm9kZXMuc2xpY2UoMCwgLXNoaWZ0KVxuICAgICAgICAgIC5yZXZlcnNlKClcbiAgICAgICAgICAubWFwKG4gPT4gbi5kb20oKSlcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHBvc2l0aW9uID0gYnVmZmVyLnBvc2l0aW9uKCk7XG4gICAgICBpZiAocG9zaXRpb24gPCBidWZmZXJSZWZyZXNoICYmIGZldGNoaW5nID09PSBmYWxzZSkge1xuICAgICAgICBjb25zdCBoZWFkSW5kZXggPSBidWZmZXIuaGVhZCgpLiQkaW5kZXg7XG4gICAgICAgIGNvbnN0IHN0YXJ0SW5kZXggPSBNYXRoLm1heCgwLCBoZWFkSW5kZXggLSBidWZmZXJSZWZyZXNoU2l6ZSk7XG4gICAgICAgIGlmIChzdGFydEluZGV4ICE9PSBoZWFkSW5kZXgpIHtcbiAgICAgICAgICBmZXRjaGluZyA9IHRydWU7XG4gICAgICAgICAgc291cmNlU3RyZWFtLnB1bGwoc3RhcnRJbmRleCwgYnVmZmVyUmVmcmVzaFNpemUpXG4gICAgICAgICAgICAudGhlbihpdGVtcyA9PiB7XG4gICAgICAgICAgICAgIGJ1ZmZlci51bnNoaWZ0KC4uLml0ZW1zLm1hcChyb3dGYWN0b3J5KSk7XG4gICAgICAgICAgICAgIGZldGNoaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBjb250YWluZXIuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgKCkgPT4ge1xuICAgICAgY29uc3Qge3Njcm9sbEhlaWdodCwgc2Nyb2xsVG9wLCBvZmZzZXRIZWlnaHR9ID0gY29udGFpbmVyO1xuICAgICAgY29uc3Qgc2Nyb2xsUmF0aW8gPSAoc2Nyb2xsVG9wICsgb2Zmc2V0SGVpZ2h0KSAvIHNjcm9sbEhlaWdodDtcblxuICAgICAgaWYgKGFudGVMYXN0U2Nyb2xsKSB7XG4gICAgICAgIGNvbnN0IHByZXZpb3VzRGlyZWN0aW9uID0gKGxhc3RTY3JvbGwgLSBhbnRlTGFzdFNjcm9sbCkgPiAwID8gJ2Rvd24nIDogJ3VwJztcbiAgICAgICAgY29uc3QgZGlyZWN0aW9uID0gc2Nyb2xsVG9wIC0gbGFzdFNjcm9sbCA+IDAgPyAnZG93bicgOiAndXAnO1xuICAgICAgICBjb25zdCBpc0RpcmVjdGlvbkNvbmZpcm1lZCA9IHByZXZpb3VzRGlyZWN0aW9uID09PSBkaXJlY3Rpb247XG5cbiAgICAgICAgaWYgKGlzRGlyZWN0aW9uQ29uZmlybWVkKSB7XG4gICAgICAgICAgaWYgKGRpcmVjdGlvbiA9PT0gJ2Rvd24nKSB7XG4gICAgICAgICAgICBzY3JvbGxEb3duKHNjcm9sbFJhdGlvKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2Nyb2xsVXAoc2Nyb2xsUmF0aW8pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgYW50ZUxhc3RTY3JvbGwgPSBsYXN0U2Nyb2xsO1xuICAgICAgbGFzdFNjcm9sbCA9IHNjcm9sbFRvcDtcbiAgICB9XG4gICk7XG5cbiAgdGFibGUub25EaXNwbGF5Q2hhbmdlKGl0ZW1zID0+IHtcbiAgICBjb250YWluZXJJbnRlcmZhY2UuZW1wdHkoKTtcbiAgICBzb3VyY2VTdHJlYW0gPSBkYXRhU291cmNlKHt0YWJsZX0pO1xuXG4gICAgLy90b2RvIGNsZWFuIG9sZCBidWZmZXJcblxuICAgIGJ1ZmZlciA9IGJ1ZmZlcmVkV2luZG93KHtidWZmZXJTaXplLCB3aW5kb3dTaXplfSk7XG4gICAgYnVmZmVyLnB1c2goLi4uaXRlbXMubWFwKHJvd0ZhY3RvcnkpKTtcblxuICAgIGNvbnN0IHtzbGljZTppbml0aWFsTm9kZXN9ID0gYnVmZmVyLnNsaWRlKDApO1xuICAgIGNvbnRhaW5lckludGVyZmFjZS5hcHBlbmQoLi4uaW5pdGlhbE5vZGVzLm1hcChuID0+IG4uZG9tKCkpKTtcblxuICAgIC8vc3RhcnQgdG8gZmlsbCB0aGUgYnVmZmVyXG4gICAgc291cmNlU3RyZWFtLnB1bGwoYnVmZmVyLmxlbmd0aCwgYnVmZmVyU2l6ZSAtIGJ1ZmZlci5sZW5ndGgpXG4gICAgICAudGhlbihpdGVtcyA9PiB7XG4gICAgICAgIGJ1ZmZlci5wdXNoKC4uLml0ZW1zLm1hcChyb3dGYWN0b3J5KSk7XG4gICAgICAgIGlmIChjb250YWluZXJJbnRlcmZhY2UubGVuZ3RoIDwgd2luZG93U2l6ZSkge1xuICAgICAgICAgIGNvbnRhaW5lckludGVyZmFjZS5lbXB0eSgpO1xuICAgICAgICAgIGNvbnN0IHtzbGljZTpub2Rlc30gPSBidWZmZXIuc2xpZGUoMCk7XG4gICAgICAgICAgY29udGFpbmVySW50ZXJmYWNlLmFwcGVuZCguLi5ub2Rlcy5tYXAobiA9PiBuLmRvbSgpKSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9KTtcbn0iLCJpbXBvcnQgdGFibGUgZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5pbXBvcnQgdmlydHVhbGl6ZXIgZnJvbSAnLi4vaW5kZXgnO1xuXG5mdW5jdGlvbiByb3dGYWN0b3J5IChpdGVtKSB7XG4gIGNvbnN0IHtpbmRleCwgdmFsdWV9ID0gaXRlbTtcbiAgY29uc3QgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdUUicpO1xuICBsaS5pbm5lckhUTUwgPSBgPHRkPiR7dmFsdWUuaWR9PC90ZD48dGQ+JHtpbmRleH08L3RkPmA7XG4gIHJldHVybiB7XG4gICAgZG9tKCl7XG4gICAgICByZXR1cm4gbGk7XG4gICAgfSxcbiAgICBjbGVhbigpe1xuICAgIH1cbiAgfVxufVxuXG5jb25zdCBkYXRhID0gW107XG5cbmZvciAobGV0IGkgPSAxOyBpIDw9IDEwMDAwOyBpKyspIHtcbiAgZGF0YS5wdXNoKHtpZDogaX0pO1xufVxuXG5jb25zdCB0ID0gdGFibGUoe1xuICBkYXRhLFxuICB0YWJsZVN0YXRlOiB7c29ydDoge30sIGZpbHRlcjoge30sIHNsaWNlOiB7cGFnZTogMSwgc2l6ZTogNTB9fVxufSk7XG5cbmNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ3Rib2R5Jyk7XG5cbnZpcnR1YWxpemVyKHtcbiAgdGFibGU6IHQsXG4gIHJvd0ZhY3RvcnksXG4gIGNvbnRhaW5lcixcbiAgLy8gYnVmZmVyU2l6ZTogMTAwMCxcbiAgLy8gd2luZG93U2l6ZTogMjAwLFxuICB0cmVzaG9sZDogMC43XG59KTtcblxudC5leGVjKCk7Il0sIm5hbWVzIjpbInBvaW50ZXIiLCJmaWx0ZXIiLCJzb3J0RmFjdG9yeSIsInNvcnQiLCJzZWFyY2giLCJ0YWJsZSIsImN1cnJ5Il0sIm1hcHBpbmdzIjoiOzs7QUFBTyxTQUFTLElBQUksRUFBRSxDQUFDLEVBQUU7RUFDdkIsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztDQUMxQjs7QUFFRCxBQUFPLFNBQVMsT0FBTyxFQUFFLEtBQUssRUFBRSxHQUFHLEdBQUcsRUFBRTtFQUN0QyxPQUFPLENBQUMsR0FBRyxJQUFJLEtBQUssR0FBRyxDQUFDLE1B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

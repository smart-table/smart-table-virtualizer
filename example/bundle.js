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
  const instance = {
    on(event, ...listeners){
      listenersLists[event] = (listenersLists[event] || []).concat(listeners);
      return instance;
    },
    dispatch(event, ...args){
      const listeners = listenersLists[event] || [];
      for (let listener of listeners) {
        listener(...args);
      }
      return instance;
    },
    off(event, ...listeners){
      if (!event) {
        Object.keys(listenersLists).forEach(ev => instance.off(ev));
      } else {
        const list = listenersLists[event] || [];
        listenersLists[event] = listeners.length ? list.filter(listener => !listeners.includes(listener)) : [];
      }
      return instance;
    }
  };
  return instance;
}

const TOGGLE_SORT = 'TOGGLE_SORT';
const DISPLAY_CHANGED = 'DISPLAY_CHANGED';
const PAGE_CHANGED = 'CHANGE_PAGE';
const EXEC_CHANGED = 'EXEC_CHANGED';
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

  const dispatchSummary = (filtered) => {
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
        const execFunc = compose(filterFunc, searchFunc, tap(dispatchSummary), sortFunc, sliceFunc);
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
      const sort = Object.assign({}, tableState.sort);
      const search = Object.assign({}, tableState.search);
      const slice = Object.assign({}, tableState.slice);
      const filter = {};
      for (let prop in tableState.filter) {
        filter[prop] = tableState.filter[prop].map(v => Object.assign({}, v));
      }
      return {sort, search, slice, filter};
    }
  };

  const instance = Object.assign(table, api);

  Object.defineProperty(instance, 'length', {
    get(){
      return data.length;
    }
  });

  return instance;
};

var tableDirective$1 = function ({
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

const table = tableDirective$1;

function* giveMeN (n) {
  for (let i = 0; i < n; i++) {
    yield i;
  }
}

const doNTimes = curry((fn, count = 1) => {
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

function rowFactory ({value}) {
  const {name:{first:firstName, last:lastName}, gender, birthDate, size} = value;
  const tr = document.createElement('TR');
  tr.innerHTML = `<td>${lastName}</td><td>${firstName}</td><td>${gender}</td><td>${birthDate.toLocaleDateString()}</td><td>${size}</td>`;
  return {
    dom(){
      return tr;
    },
    clean(){
    }
  }
}

const t = table({
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zb3J0L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWZpbHRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zZWFyY2gvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZXZlbnRzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2V2ZW50cy5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvaW5kZXguanMiLCIuLi9saWIvaGVscGVyLmpzIiwiLi4vbGliL2RhdGFTb3VyY2UuanMiLCIuLi9saWIvYnVmZmVyZWRXaW5kb3cuanMiLCIuLi9saWIvY29udGFpbmVyLmpzIiwiLi4vaW5kZXguanMiLCJpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwb2ludGVyIChwYXRoKSB7XG5cbiAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XG5cbiAgZnVuY3Rpb24gcGFydGlhbCAob2JqID0ge30sIHBhcnRzID0gW10pIHtcbiAgICBjb25zdCBwID0gcGFydHMuc2hpZnQoKTtcbiAgICBjb25zdCBjdXJyZW50ID0gb2JqW3BdO1xuICAgIHJldHVybiAoY3VycmVudCA9PT0gdW5kZWZpbmVkIHx8IHBhcnRzLmxlbmd0aCA9PT0gMCkgP1xuICAgICAgY3VycmVudCA6IHBhcnRpYWwoY3VycmVudCwgcGFydHMpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0ICh0YXJnZXQsIG5ld1RyZWUpIHtcbiAgICBsZXQgY3VycmVudCA9IHRhcmdldDtcbiAgICBjb25zdCBbbGVhZiwgLi4uaW50ZXJtZWRpYXRlXSA9IHBhcnRzLnJldmVyc2UoKTtcbiAgICBmb3IgKGxldCBrZXkgb2YgaW50ZXJtZWRpYXRlLnJldmVyc2UoKSkge1xuICAgICAgaWYgKGN1cnJlbnRba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGN1cnJlbnRba2V5XSA9IHt9O1xuICAgICAgICBjdXJyZW50ID0gY3VycmVudFtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBjdXJyZW50W2xlYWZdID0gT2JqZWN0LmFzc2lnbihjdXJyZW50W2xlYWZdIHx8IHt9LCBuZXdUcmVlKTtcbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBnZXQodGFyZ2V0KXtcbiAgICAgIHJldHVybiBwYXJ0aWFsKHRhcmdldCwgWy4uLnBhcnRzXSlcbiAgICB9LFxuICAgIHNldFxuICB9XG59O1xuIiwiaW1wb3J0IHtzd2FwfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuXG5mdW5jdGlvbiBzb3J0QnlQcm9wZXJ0eSAocHJvcCkge1xuICBjb25zdCBwcm9wR2V0dGVyID0gcG9pbnRlcihwcm9wKS5nZXQ7XG4gIHJldHVybiAoYSwgYikgPT4ge1xuICAgIGNvbnN0IGFWYWwgPSBwcm9wR2V0dGVyKGEpO1xuICAgIGNvbnN0IGJWYWwgPSBwcm9wR2V0dGVyKGIpO1xuXG4gICAgaWYgKGFWYWwgPT09IGJWYWwpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGlmIChiVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICBpZiAoYVZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gYVZhbCA8IGJWYWwgPyAtMSA6IDE7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc29ydEZhY3RvcnkgKHtwb2ludGVyLCBkaXJlY3Rpb259ID0ge30pIHtcbiAgaWYgKCFwb2ludGVyIHx8IGRpcmVjdGlvbiA9PT0gJ25vbmUnKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IFsuLi5hcnJheV07XG4gIH1cblxuICBjb25zdCBvcmRlckZ1bmMgPSBzb3J0QnlQcm9wZXJ0eShwb2ludGVyKTtcbiAgY29uc3QgY29tcGFyZUZ1bmMgPSBkaXJlY3Rpb24gPT09ICdkZXNjJyA/IHN3YXAob3JkZXJGdW5jKSA6IG9yZGVyRnVuYztcblxuICByZXR1cm4gKGFycmF5KSA9PiBbLi4uYXJyYXldLnNvcnQoY29tcGFyZUZ1bmMpO1xufSIsImltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmZ1bmN0aW9uIHR5cGVFeHByZXNzaW9uICh0eXBlKSB7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIEJvb2xlYW47XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBOdW1iZXI7XG4gICAgY2FzZSAnZGF0ZSc6XG4gICAgICByZXR1cm4gKHZhbCkgPT4gbmV3IERhdGUodmFsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGNvbXBvc2UoU3RyaW5nLCAodmFsKSA9PiB2YWwudG9Mb3dlckNhc2UoKSk7XG4gIH1cbn1cblxuY29uc3Qgb3BlcmF0b3JzID0ge1xuICBpbmNsdWRlcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQuaW5jbHVkZXModmFsdWUpO1xuICB9LFxuICBpcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGlzTm90KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiAhT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGx0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8IHZhbHVlO1xuICB9LFxuICBndCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPiB2YWx1ZTtcbiAgfSxcbiAgbHRlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8PSB2YWx1ZTtcbiAgfSxcbiAgZ3RlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+PSB2YWx1ZTtcbiAgfSxcbiAgZXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSA9PSBpbnB1dDtcbiAgfSxcbiAgbm90RXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSAhPSBpbnB1dDtcbiAgfVxufTtcblxuY29uc3QgZXZlcnkgPSBmbnMgPT4gKC4uLmFyZ3MpID0+IGZucy5ldmVyeShmbiA9PiBmbiguLi5hcmdzKSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVkaWNhdGUgKHt2YWx1ZSA9ICcnLCBvcGVyYXRvciA9ICdpbmNsdWRlcycsIHR5cGUgPSAnc3RyaW5nJ30pIHtcbiAgY29uc3QgdHlwZUl0ID0gdHlwZUV4cHJlc3Npb24odHlwZSk7XG4gIGNvbnN0IG9wZXJhdGVPblR5cGVkID0gY29tcG9zZSh0eXBlSXQsIG9wZXJhdG9yc1tvcGVyYXRvcl0pO1xuICBjb25zdCBwcmVkaWNhdGVGdW5jID0gb3BlcmF0ZU9uVHlwZWQodmFsdWUpO1xuICByZXR1cm4gY29tcG9zZSh0eXBlSXQsIHByZWRpY2F0ZUZ1bmMpO1xufVxuXG4vL2F2b2lkIHVzZWxlc3MgZmlsdGVyIGxvb2t1cCAoaW1wcm92ZSBwZXJmKVxuZnVuY3Rpb24gbm9ybWFsaXplQ2xhdXNlcyAoY29uZikge1xuICBjb25zdCBvdXRwdXQgPSB7fTtcbiAgY29uc3QgdmFsaWRQYXRoID0gT2JqZWN0LmtleXMoY29uZikuZmlsdGVyKHBhdGggPT4gQXJyYXkuaXNBcnJheShjb25mW3BhdGhdKSk7XG4gIHZhbGlkUGF0aC5mb3JFYWNoKHBhdGggPT4ge1xuICAgIGNvbnN0IHZhbGlkQ2xhdXNlcyA9IGNvbmZbcGF0aF0uZmlsdGVyKGMgPT4gYy52YWx1ZSAhPT0gJycpO1xuICAgIGlmICh2YWxpZENsYXVzZXMubGVuZ3RoKSB7XG4gICAgICBvdXRwdXRbcGF0aF0gPSB2YWxpZENsYXVzZXM7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmlsdGVyIChmaWx0ZXIpIHtcbiAgY29uc3Qgbm9ybWFsaXplZENsYXVzZXMgPSBub3JtYWxpemVDbGF1c2VzKGZpbHRlcik7XG4gIGNvbnN0IGZ1bmNMaXN0ID0gT2JqZWN0LmtleXMobm9ybWFsaXplZENsYXVzZXMpLm1hcChwYXRoID0+IHtcbiAgICBjb25zdCBnZXR0ZXIgPSBwb2ludGVyKHBhdGgpLmdldDtcbiAgICBjb25zdCBjbGF1c2VzID0gbm9ybWFsaXplZENsYXVzZXNbcGF0aF0ubWFwKHByZWRpY2F0ZSk7XG4gICAgcmV0dXJuIGNvbXBvc2UoZ2V0dGVyLCBldmVyeShjbGF1c2VzKSk7XG4gIH0pO1xuICBjb25zdCBmaWx0ZXJQcmVkaWNhdGUgPSBldmVyeShmdW5jTGlzdCk7XG5cbiAgcmV0dXJuIChhcnJheSkgPT4gYXJyYXkuZmlsdGVyKGZpbHRlclByZWRpY2F0ZSk7XG59IiwiaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHNlYXJjaENvbmYgPSB7fSkge1xuICBjb25zdCB7dmFsdWUsIHNjb3BlID0gW119ID0gc2VhcmNoQ29uZjtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlcnMgPSBzY29wZS5tYXAoZmllbGQgPT4gcG9pbnRlcihmaWVsZCkuZ2V0KTtcbiAgaWYgKCFzY29wZS5sZW5ndGggfHwgIXZhbHVlKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBhcnJheSA9PiBhcnJheS5maWx0ZXIoaXRlbSA9PiBzZWFyY2hQb2ludGVycy5zb21lKHAgPT4gU3RyaW5nKHAoaXRlbSkpLmluY2x1ZGVzKFN0cmluZyh2YWx1ZSkpKSlcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNsaWNlRmFjdG9yeSAoe3BhZ2UgPSAxLCBzaXplfSA9IHt9KSB7XG4gIHJldHVybiBmdW5jdGlvbiBzbGljZUZ1bmN0aW9uIChhcnJheSA9IFtdKSB7XG4gICAgY29uc3QgYWN0dWFsU2l6ZSA9IHNpemUgfHwgYXJyYXkubGVuZ3RoO1xuICAgIGNvbnN0IG9mZnNldCA9IChwYWdlIC0gMSkgKiBhY3R1YWxTaXplO1xuICAgIHJldHVybiBhcnJheS5zbGljZShvZmZzZXQsIG9mZnNldCArIGFjdHVhbFNpemUpO1xuICB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGVtaXR0ZXIgKCkge1xuXG4gIGNvbnN0IGxpc3RlbmVyc0xpc3RzID0ge307XG4gIGNvbnN0IGluc3RhbmNlID0ge1xuICAgIG9uKGV2ZW50LCAuLi5saXN0ZW5lcnMpe1xuICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gKGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXSkuY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBkaXNwYXRjaChldmVudCwgLi4uYXJncyl7XG4gICAgICBjb25zdCBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW107XG4gICAgICBmb3IgKGxldCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgbGlzdGVuZXIoLi4uYXJncyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBvZmYoZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGxpc3RlbmVyc0xpc3RzKS5mb3JFYWNoKGV2ID0+IGluc3RhbmNlLm9mZihldikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gbGlzdGVuZXJzLmxlbmd0aCA/IGxpc3QuZmlsdGVyKGxpc3RlbmVyID0+ICFsaXN0ZW5lcnMuaW5jbHVkZXMobGlzdGVuZXIpKSA6IFtdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgIH1cbiAgfTtcbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJveHlMaXN0ZW5lciAoZXZlbnRNYXApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh7ZW1pdHRlcn0pIHtcblxuICAgIGNvbnN0IHByb3h5ID0ge307XG4gICAgbGV0IGV2ZW50TGlzdGVuZXJzID0ge307XG5cbiAgICBmb3IgKGxldCBldiBvZiBPYmplY3Qua2V5cyhldmVudE1hcCkpIHtcbiAgICAgIGNvbnN0IG1ldGhvZCA9IGV2ZW50TWFwW2V2XTtcbiAgICAgIGV2ZW50TGlzdGVuZXJzW2V2XSA9IFtdO1xuICAgICAgcHJveHlbbWV0aG9kXSA9IGZ1bmN0aW9uICguLi5saXN0ZW5lcnMpIHtcbiAgICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gZXZlbnRMaXN0ZW5lcnNbZXZdLmNvbmNhdChsaXN0ZW5lcnMpO1xuICAgICAgICBlbWl0dGVyLm9uKGV2LCAuLi5saXN0ZW5lcnMpO1xuICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHByb3h5LCB7XG4gICAgICBvZmYoZXYpe1xuICAgICAgICBpZiAoIWV2KSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMoZXZlbnRMaXN0ZW5lcnMpLmZvckVhY2goZXZlbnROYW1lID0+IHByb3h5Lm9mZihldmVudE5hbWUpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnRMaXN0ZW5lcnNbZXZdKSB7XG4gICAgICAgICAgZW1pdHRlci5vZmYoZXYsIC4uLmV2ZW50TGlzdGVuZXJzW2V2XSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59IiwiZXhwb3J0IGNvbnN0IFRPR0dMRV9TT1JUID0gJ1RPR0dMRV9TT1JUJztcbmV4cG9ydCBjb25zdCBESVNQTEFZX0NIQU5HRUQgPSAnRElTUExBWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBQQUdFX0NIQU5HRUQgPSAnQ0hBTkdFX1BBR0UnO1xuZXhwb3J0IGNvbnN0IEVYRUNfQ0hBTkdFRCA9ICdFWEVDX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IEZJTFRFUl9DSEFOR0VEID0gJ0ZJTFRFUl9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTVU1NQVJZX0NIQU5HRUQgPSAnU1VNTUFSWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTRUFSQ0hfQ0hBTkdFRCA9ICdTRUFSQ0hfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRVhFQ19FUlJPUiA9ICdFWEVDX0VSUk9SJzsiLCJpbXBvcnQgc2xpY2UgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtjdXJyeSwgdGFwLCBjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcbmltcG9ydCB7ZW1pdHRlcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcbmltcG9ydCBzbGljZUZhY3RvcnkgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtcbiAgU1VNTUFSWV9DSEFOR0VELFxuICBUT0dHTEVfU09SVCxcbiAgRElTUExBWV9DSEFOR0VELFxuICBQQUdFX0NIQU5HRUQsXG4gIEVYRUNfQ0hBTkdFRCxcbiAgRklMVEVSX0NIQU5HRUQsXG4gIFNFQVJDSF9DSEFOR0VELFxuICBFWEVDX0VSUk9SXG59IGZyb20gJy4uL2V2ZW50cyc7XG5cbmZ1bmN0aW9uIGN1cnJpZWRQb2ludGVyIChwYXRoKSB7XG4gIGNvbnN0IHtnZXQsIHNldH0gPSBwb2ludGVyKHBhdGgpO1xuICByZXR1cm4ge2dldCwgc2V0OiBjdXJyeShzZXQpfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtcbiAgc29ydEZhY3RvcnksXG4gIHRhYmxlU3RhdGUsXG4gIGRhdGEsXG4gIGZpbHRlckZhY3RvcnksXG4gIHNlYXJjaEZhY3Rvcnlcbn0pIHtcbiAgY29uc3QgdGFibGUgPSBlbWl0dGVyKCk7XG4gIGNvbnN0IHNvcnRQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NvcnQnKTtcbiAgY29uc3Qgc2xpY2VQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NsaWNlJyk7XG4gIGNvbnN0IGZpbHRlclBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignZmlsdGVyJyk7XG4gIGNvbnN0IHNlYXJjaFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2VhcmNoJyk7XG5cbiAgY29uc3Qgc2FmZUFzc2lnbiA9IGN1cnJ5KChiYXNlLCBleHRlbnNpb24pID0+IE9iamVjdC5hc3NpZ24oe30sIGJhc2UsIGV4dGVuc2lvbikpO1xuICBjb25zdCBkaXNwYXRjaCA9IGN1cnJ5KHRhYmxlLmRpc3BhdGNoLmJpbmQodGFibGUpLCAyKTtcblxuICBjb25zdCBkaXNwYXRjaFN1bW1hcnkgPSAoZmlsdGVyZWQpID0+IHtcbiAgICBkaXNwYXRjaChTVU1NQVJZX0NIQU5HRUQsIHtcbiAgICAgIHBhZ2U6IHRhYmxlU3RhdGUuc2xpY2UucGFnZSxcbiAgICAgIHNpemU6IHRhYmxlU3RhdGUuc2xpY2Uuc2l6ZSxcbiAgICAgIGZpbHRlcmVkQ291bnQ6IGZpbHRlcmVkLmxlbmd0aFxuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IGV4ZWMgPSAoe3Byb2Nlc3NpbmdEZWxheSA9IDIwfSA9IHt9KSA9PiB7XG4gICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogdHJ1ZX0pO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNvcnRGdW5jID0gc29ydEZhY3Rvcnkoc29ydFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgdGFwKGRpc3BhdGNoU3VtbWFyeSksIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICBjb25zdCBkaXNwbGF5ZWQgPSBleGVjRnVuYyhkYXRhKTtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRElTUExBWV9DSEFOR0VELCBkaXNwbGF5ZWQubWFwKGQgPT4ge1xuICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9O1xuICAgICAgICB9KSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfRVJST1IsIGUpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogZmFsc2V9KTtcbiAgICAgIH1cbiAgICB9LCBwcm9jZXNzaW5nRGVsYXkpO1xuICB9O1xuXG4gIGNvbnN0IHVwZGF0ZVRhYmxlU3RhdGUgPSBjdXJyeSgocHRlciwgZXYsIG5ld1BhcnRpYWxTdGF0ZSkgPT4gY29tcG9zZShcbiAgICBzYWZlQXNzaWduKHB0ZXIuZ2V0KHRhYmxlU3RhdGUpKSxcbiAgICB0YXAoZGlzcGF0Y2goZXYpKSxcbiAgICBwdGVyLnNldCh0YWJsZVN0YXRlKVxuICApKG5ld1BhcnRpYWxTdGF0ZSkpO1xuXG4gIGNvbnN0IHJlc2V0VG9GaXJzdFBhZ2UgPSAoKSA9PiB1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VELCB7cGFnZTogMX0pO1xuXG4gIGNvbnN0IHRhYmxlT3BlcmF0aW9uID0gKHB0ZXIsIGV2KSA9PiBjb21wb3NlKFxuICAgIHVwZGF0ZVRhYmxlU3RhdGUocHRlciwgZXYpLFxuICAgIHJlc2V0VG9GaXJzdFBhZ2UsXG4gICAgKCkgPT4gdGFibGUuZXhlYygpIC8vIHdlIHdyYXAgd2l0aGluIGEgZnVuY3Rpb24gc28gdGFibGUuZXhlYyBjYW4gYmUgb3ZlcndyaXR0ZW4gKHdoZW4gdXNpbmcgd2l0aCBhIHNlcnZlciBmb3IgZXhhbXBsZSlcbiAgKTtcblxuICBjb25zdCBhcGkgPSB7XG4gICAgc29ydDogdGFibGVPcGVyYXRpb24oc29ydFBvaW50ZXIsIFRPR0dMRV9TT1JUKSxcbiAgICBmaWx0ZXI6IHRhYmxlT3BlcmF0aW9uKGZpbHRlclBvaW50ZXIsIEZJTFRFUl9DSEFOR0VEKSxcbiAgICBzZWFyY2g6IHRhYmxlT3BlcmF0aW9uKHNlYXJjaFBvaW50ZXIsIFNFQVJDSF9DSEFOR0VEKSxcbiAgICBzbGljZTogY29tcG9zZSh1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VEKSwgKCkgPT4gdGFibGUuZXhlYygpKSxcbiAgICBleGVjLFxuICAgIGV2YWwoc3RhdGUgPSB0YWJsZVN0YXRlKXtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgICAgcmV0dXJuIGV4ZWNGdW5jKGRhdGEpLm1hcChkID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgb25EaXNwbGF5Q2hhbmdlKGZuKXtcbiAgICAgIHRhYmxlLm9uKERJU1BMQVlfQ0hBTkdFRCwgZm4pO1xuICAgIH0sXG4gICAgZ2V0VGFibGVTdGF0ZSgpe1xuICAgICAgY29uc3Qgc29ydCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc29ydCk7XG4gICAgICBjb25zdCBzZWFyY2ggPSBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLnNlYXJjaCk7XG4gICAgICBjb25zdCBzbGljZSA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2xpY2UpO1xuICAgICAgY29uc3QgZmlsdGVyID0ge307XG4gICAgICBmb3IgKGxldCBwcm9wIGluIHRhYmxlU3RhdGUuZmlsdGVyKSB7XG4gICAgICAgIGZpbHRlcltwcm9wXSA9IHRhYmxlU3RhdGUuZmlsdGVyW3Byb3BdLm1hcCh2ID0+IE9iamVjdC5hc3NpZ24oe30sIHYpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7c29ydCwgc2VhcmNoLCBzbGljZSwgZmlsdGVyfTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaW5zdGFuY2UgPSBPYmplY3QuYXNzaWduKHRhYmxlLCBhcGkpO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpbnN0YW5jZSwgJ2xlbmd0aCcsIHtcbiAgICBnZXQoKXtcbiAgICAgIHJldHVybiBkYXRhLmxlbmd0aDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn0iLCJpbXBvcnQgc29ydCBmcm9tICdzbWFydC10YWJsZS1zb3J0JztcbmltcG9ydCBmaWx0ZXIgZnJvbSAnc21hcnQtdGFibGUtZmlsdGVyJztcbmltcG9ydCBzZWFyY2ggZnJvbSAnc21hcnQtdGFibGUtc2VhcmNoJztcbmltcG9ydCB0YWJsZSBmcm9tICcuL2RpcmVjdGl2ZXMvdGFibGUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSA9IHNvcnQsXG4gIGZpbHRlckZhY3RvcnkgPSBmaWx0ZXIsXG4gIHNlYXJjaEZhY3RvcnkgPSBzZWFyY2gsXG4gIHRhYmxlU3RhdGUgPSB7c29ydDoge30sIHNsaWNlOiB7cGFnZTogMX0sIGZpbHRlcjoge30sIHNlYXJjaDoge319LFxuICBkYXRhID0gW11cbn0sIC4uLnRhYmxlRGlyZWN0aXZlcykge1xuXG4gIGNvbnN0IGNvcmVUYWJsZSA9IHRhYmxlKHtzb3J0RmFjdG9yeSwgZmlsdGVyRmFjdG9yeSwgdGFibGVTdGF0ZSwgZGF0YSwgc2VhcmNoRmFjdG9yeX0pO1xuXG4gIHJldHVybiB0YWJsZURpcmVjdGl2ZXMucmVkdWNlKChhY2N1bXVsYXRvciwgbmV3ZGlyKSA9PiB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oYWNjdW11bGF0b3IsIG5ld2Rpcih7XG4gICAgICBzb3J0RmFjdG9yeSxcbiAgICAgIGZpbHRlckZhY3RvcnksXG4gICAgICBzZWFyY2hGYWN0b3J5LFxuICAgICAgdGFibGVTdGF0ZSxcbiAgICAgIGRhdGEsXG4gICAgICB0YWJsZTogY29yZVRhYmxlXG4gICAgfSkpO1xuICB9LCBjb3JlVGFibGUpO1xufSIsImltcG9ydCB0YWJsZURpcmVjdGl2ZSBmcm9tICcuL3NyYy90YWJsZSc7XG5pbXBvcnQgZmlsdGVyRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvZmlsdGVyJztcbmltcG9ydCBzZWFyY2hEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zZWFyY2gnO1xuaW1wb3J0IHNsaWNlRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvc2xpY2UnO1xuaW1wb3J0IHNvcnREaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zb3J0JztcbmltcG9ydCBzdW1tYXJ5RGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvc3VtbWFyeSc7XG5pbXBvcnQgd29ya2luZ0luZGljYXRvckRpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3dvcmtpbmdJbmRpY2F0b3InO1xuXG5leHBvcnQgY29uc3Qgc2VhcmNoID0gc2VhcmNoRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHNsaWNlID0gc2xpY2VEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc3VtbWFyeSA9IHN1bW1hcnlEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc29ydCA9IHNvcnREaXJlY3RpdmU7XG5leHBvcnQgY29uc3QgZmlsdGVyID0gZmlsdGVyRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHdvcmtpbmdJbmRpY2F0b3IgPSB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHRhYmxlID0gdGFibGVEaXJlY3RpdmU7XG5leHBvcnQgZGVmYXVsdCB0YWJsZTtcbiIsImltcG9ydCB7Y3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmV4cG9ydCBmdW5jdGlvbiogZ2l2ZU1lTiAobikge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG47IGkrKykge1xuICAgIHlpZWxkIGk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGRvTlRpbWVzID0gY3VycnkoKGZuLCBjb3VudCA9IDEpID0+IHtcbiAgY29uc3QgbiA9IGNvdW50IHx8IDE7XG4gIFsuLi5naXZlTWVOKG4pXS5mb3JFYWNoKCgpID0+IGZuKCkpO1xufSwgMik7XG4iLCJpbXBvcnQge2dpdmVNZU59IGZyb20gJy4vaGVscGVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHt0YWJsZX0pIHtcbiAgcmV0dXJuIHtcbiAgICBwdWxsKG9mZnNldCwgbnVtYmVyKXtcbiAgICAgIGNvbnN0IHRhYmxlU3RhdGUgPSB0YWJsZS5nZXRUYWJsZVN0YXRlKCk7XG4gICAgICBjb25zdCB7c2xpY2U6e3NpemU6cGFnZVNpemV9fSA9IHRhYmxlU3RhdGU7XG4gICAgICBjb25zdCBzdGFydFBhZ2UgPSBNYXRoLmZsb29yKG9mZnNldCAvIHBhZ2VTaXplKTtcbiAgICAgIGNvbnN0IHRyaW1CZWZvcmUgPSBvZmZzZXQgJSBwYWdlU2l6ZTtcbiAgICAgIGNvbnN0IGxhc3RQYWdlID0gTWF0aC5jZWlsKChvZmZzZXQgKyBudW1iZXIpIC8gcGFnZVNpemUpO1xuICAgICAgY29uc3QgcGFnZUNvbmZMaXN0ID0gWy4uLmdpdmVNZU4obGFzdFBhZ2UgLSBzdGFydFBhZ2UpXS5tYXAob2ZmID0+ICh7XG4gICAgICAgIHBhZ2U6IHN0YXJ0UGFnZSArIG9mZiArIDEsXG4gICAgICAgIHNpemU6IHBhZ2VTaXplXG4gICAgICB9KSk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5hbGwocGFnZUNvbmZMaXN0Lm1hcChzbGljZSA9PiB7XG4gICAgICAgIHJldHVybiB0YWJsZS5ldmFsKE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUsIHtzbGljZX0pKTtcbiAgICAgIH0sIFtdKSlcbiAgICAgICAgLnRoZW4ocGFnZXMgPT4ge1xuICAgICAgICAgIHJldHVybiBwYWdlcy5yZWR1Y2UoKGFjYywgY3VycikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFjYy5jb25jYXQoY3Vycik7XG4gICAgICAgICAgfSwgW10pXG4gICAgICAgICAgICAuZmlsdGVyKChpdGVtLCBpbmRleCkgPT4gaW5kZXggPj0gdHJpbUJlZm9yZSlcbiAgICAgICAgICAgIC5zbGljZSgwLCBudW1iZXIpO1xuICAgICAgICB9KTtcbiAgICB9XG4gIH07XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtidWZmZXJTaXplID0gMTAwMCwgd2luZG93U2l6ZSA9IDIwMH0gPSB7fSkge1xuXG4gIGNvbnN0IGRhdGFMaXN0ID0gW107XG4gIGxldCB3aW5kb3dDdXJzb3IgPSBudWxsO1xuXG4gIGNvbnN0IGluc3RhbmNlID0ge1xuICAgIHB1c2goKXtcbiAgICAgIGNvbnN0IGl0ZW1zID0gWy4uLmFyZ3VtZW50c107XG4gICAgICBjb25zdCBtYXhSZW1vdmFibGVJdGVtQ291bnQgPSBNYXRoLm1pbihkYXRhTGlzdC5pbmRleE9mKHdpbmRvd0N1cnNvciksIGl0ZW1zLmxlbmd0aCk7XG4gICAgICBjb25zdCBsaW1pdCA9IGRhdGFMaXN0Lmxlbmd0aCA8IGJ1ZmZlclNpemUgPyBidWZmZXJTaXplIC0gZGF0YUxpc3QubGVuZ3RoIDogbWF4UmVtb3ZhYmxlSXRlbUNvdW50O1xuICAgICAgY29uc3QgdG9BcHBlbmQgPSBpdGVtcy5zbGljZSgwLCBsaW1pdCk7XG4gICAgICBjb25zdCB0YWlsSXRlbSA9IGluc3RhbmNlLnRhaWwoKTtcbiAgICAgIGNvbnN0IHN0YXJ0SW5kZXggPSB0YWlsSXRlbSA/IHRhaWxJdGVtLiQkaW5kZXggKyAxIDogMDtcbiAgICAgIGRhdGFMaXN0LnB1c2goLi4udG9BcHBlbmQubWFwKChpdGVtLCBvZmZzZXQpID0+IE9iamVjdC5hc3NpZ24oeyQkaW5kZXg6IHN0YXJ0SW5kZXggKyBvZmZzZXR9LCBpdGVtKSkpO1xuICAgICAgaWYgKGRhdGFMaXN0Lmxlbmd0aCA+IGJ1ZmZlclNpemUpIHtcbiAgICAgICAgY29uc3QgdG9Ecm9wID0gZGF0YUxpc3Quc3BsaWNlKDAsIGxpbWl0KTtcbiAgICAgICAgdG9Ecm9wLmZvckVhY2goaXRlbSA9PiB7XG4gICAgICAgICAgaWYgKGl0ZW0uY2xlYW4pIHtcbiAgICAgICAgICAgIGl0ZW0uY2xlYW4oKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgdW5zaGlmdCgpe1xuICAgICAgY29uc3QgaXRlbXMgPSBbLi4uYXJndW1lbnRzXTtcbiAgICAgIGNvbnN0IHVwcGVyV2luZG93SW5kZXggPSBNYXRoLm1pbihkYXRhTGlzdC5pbmRleE9mKHdpbmRvd0N1cnNvcikgKyB3aW5kb3dTaXplLCBkYXRhTGlzdC5sZW5ndGggLSAxKTtcbiAgICAgIGNvbnN0IG1heFJlbW92YWJsZUl0ZW1Db3VudCA9IE1hdGgubWluKGRhdGFMaXN0Lmxlbmd0aCAtIHVwcGVyV2luZG93SW5kZXgsIGl0ZW1zLmxlbmd0aCk7XG4gICAgICBjb25zdCBsaW1pdCA9IGRhdGFMaXN0Lmxlbmd0aCA8IGJ1ZmZlclNpemUgPyBidWZmZXJTaXplIC0gZGF0YUxpc3QubGVuZ3RoIDogbWF4UmVtb3ZhYmxlSXRlbUNvdW50O1xuICAgICAgY29uc3QgdG9QcmVwZW5kID0gaXRlbXMuc2xpY2UoMCwgbGltaXQpO1xuICAgICAgY29uc3Qgc3RhcnRJbmRleCA9IGluc3RhbmNlLmhlYWQoKS4kJGluZGV4IC0gbGltaXQ7XG4gICAgICBkYXRhTGlzdC51bnNoaWZ0KC4uLnRvUHJlcGVuZC5tYXAoKGl0ZW0sIG9mZnNldCkgPT4gT2JqZWN0LmFzc2lnbih7JCRpbmRleDogc3RhcnRJbmRleCArIG9mZnNldH0sIGl0ZW0pKSk7XG4gICAgICBpZiAoZGF0YUxpc3QubGVuZ3RoID4gYnVmZmVyU2l6ZSkge1xuICAgICAgICBjb25zdCB0b0Ryb3AgPSBkYXRhTGlzdC5zcGxpY2UoLWxpbWl0KTtcbiAgICAgICAgdG9Ecm9wLmZvckVhY2goaXRlbSA9PiB7XG4gICAgICAgICAgaWYgKGl0ZW0uY2xlYW4pIHtcbiAgICAgICAgICAgIGl0ZW0uY2xlYW4oKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgZ2V0KGluZGV4KXtcbiAgICAgIHJldHVybiBkYXRhTGlzdC5maW5kKGl0ZW0gPT4gaXRlbS4kJGluZGV4ID09PSBpbmRleCk7XG4gICAgfSxcbiAgICBoZWFkKCl7XG4gICAgICByZXR1cm4gZGF0YUxpc3RbMF0gfHwgbnVsbDtcbiAgICB9LFxuICAgIHRhaWwoKXtcbiAgICAgIHJldHVybiBkYXRhTGlzdC5sZW5ndGggPyBkYXRhTGlzdFtkYXRhTGlzdC5sZW5ndGggLSAxXSA6IG51bGw7XG4gICAgfSxcbiAgICBzbGlkZShvZmZzZXQpe1xuICAgICAgY29uc3QgY3Vyc29ySW5kZXggPSB3aW5kb3dDdXJzb3IgIT09IG51bGwgPyBkYXRhTGlzdC5pbmRleE9mKHdpbmRvd0N1cnNvcikgOiAwO1xuICAgICAgY29uc3QgaW5kZXggPSBNYXRoLm1heChjdXJzb3JJbmRleCArIG9mZnNldCwgMCk7XG4gICAgICBjb25zdCBzdGFydCA9IGluZGV4ICsgd2luZG93U2l6ZSA+PSAoYnVmZmVyU2l6ZSAtIDEpID8gYnVmZmVyU2l6ZSAtIHdpbmRvd1NpemUgOiBpbmRleDtcbiAgICAgIGNvbnN0IHNsaWNlID0gZGF0YUxpc3Quc2xpY2Uoc3RhcnQsIHN0YXJ0ICsgd2luZG93U2l6ZSk7XG4gICAgICBjb25zdCBzaGlmdCA9IHN0YXJ0IC0gY3Vyc29ySW5kZXg7XG4gICAgICB3aW5kb3dDdXJzb3IgPSBkYXRhTGlzdFtzdGFydF07XG4gICAgICByZXR1cm4ge3NsaWNlLCBzaGlmdH07XG4gICAgfSxcbiAgICBwb3NpdGlvbigpe1xuICAgICAgcmV0dXJuIChkYXRhTGlzdC5pbmRleE9mKHdpbmRvd0N1cnNvcikgKyAxKSAvIChidWZmZXJTaXplIC0gd2luZG93U2l6ZSk7XG4gICAgfVxuICB9O1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpbnN0YW5jZSwgJ2xlbmd0aCcsIHtcbiAgICBnZXQoKXtcbiAgICAgIHJldHVybiBkYXRhTGlzdC5sZW5ndGg7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gaW5zdGFuY2U7XG59IiwiaW1wb3J0IHtkb05UaW1lc30gZnJvbSAnLi9oZWxwZXInXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7ZWxlbWVudCwgd2luZG93U2l6ZX0pIHtcblxuICBjb25zdCBpbnN0YW5jZSA9IHtcbiAgICBhcHBlbmQoLi4uYXJncyl7XG4gICAgICBmb3IgKGxldCBpdGVtIG9mIGFyZ3MpIHtcbiAgICAgICAgZWxlbWVudC5hcHBlbmRDaGlsZChpdGVtKTtcbiAgICAgICAgaWYgKGluc3RhbmNlLmxlbmd0aCA+IHdpbmRvd1NpemUpIHtcbiAgICAgICAgICBpbnN0YW5jZS5kcm9wQmVnaW4oaW5zdGFuY2UubGVuZ3RoIC0gd2luZG93U2l6ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIHByZXBlbmQoLi4uYXJncyl7XG4gICAgICBmb3IgKGxldCBpdGVtIG9mIGFyZ3MpIHtcbiAgICAgICAgZWxlbWVudC5pbnNlcnRCZWZvcmUoaXRlbSwgZWxlbWVudC5maXJzdENoaWxkKTtcbiAgICAgICAgaWYgKGluc3RhbmNlLmxlbmd0aCA+IHdpbmRvd1NpemUpIHtcbiAgICAgICAgICBpbnN0YW5jZS5kcm9wRW5kKGluc3RhbmNlLmxlbmd0aCAtIHdpbmRvd1NpemUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBkcm9wQmVnaW46IGRvTlRpbWVzKCgpID0+IHtcbiAgICAgIGNvbnN0IGZpcnN0Q2hpbGQgPSBlbGVtZW50LmZpcnN0Q2hpbGQ7XG4gICAgICBpZiAoZmlyc3RDaGlsZCkge1xuICAgICAgICBmaXJzdENoaWxkLnJlbW92ZSgpO1xuICAgICAgfVxuICAgIH0pLFxuICAgIGRyb3BFbmQ6IGRvTlRpbWVzKCgpID0+IHtcbiAgICAgIGNvbnN0IGxhc3RDaGlsZCA9IGVsZW1lbnQubGFzdENoaWxkO1xuICAgICAgaWYgKGxhc3RDaGlsZCkge1xuICAgICAgICBsYXN0Q2hpbGQucmVtb3ZlKCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgZW1wdHkoKXtcbiAgICAgIGVsZW1lbnQuaW5uZXJIVE1MID0gJyc7XG4gICAgfVxuICB9O1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpbnN0YW5jZSwgJ2xlbmd0aCcsIHtcbiAgICBnZXQoKXtcbiAgICAgIHJldHVybiBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn0iLCJpbXBvcnQgZGF0YVNvdXJjZSBmcm9tICcuL2xpYi9kYXRhU291cmNlJztcbmltcG9ydCBidWZmZXJlZFdpbmRvdyBmcm9tICcuL2xpYi9idWZmZXJlZFdpbmRvdyc7XG5pbXBvcnQgY29udGFpbmVyRmFjdG9yeSBmcm9tICcuL2xpYi9jb250YWluZXInO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2NvbnRhaW5lciwgdGFibGUsIHJvd0ZhY3RvcnksIHdpbmRvd1NpemUgPSAyMDAsIGJ1ZmZlclNpemUgPSAxMDAwLCB0cmVzaG9sZCA9IDAuOH0pIHtcbiAgbGV0IHNvdXJjZVN0cmVhbSA9IG51bGw7XG4gIGxldCBidWZmZXIgPSBudWxsO1xuICBsZXQgZmV0Y2hpbmcgPSBmYWxzZTtcbiAgbGV0IGxhc3RTY3JvbGw7XG4gIGxldCBhbnRlTGFzdFNjcm9sbDtcblxuICBjb25zdCBidWZmZXJSZWZyZXNoID0gMC41O1xuICBjb25zdCBidWZmZXJSZWZyZXNoU2l6ZSA9IGJ1ZmZlclJlZnJlc2ggKiBidWZmZXJTaXplIC8gMjtcblxuICBjb25zdCBjb250YWluZXJJbnRlcmZhY2UgPSBjb250YWluZXJGYWN0b3J5KHtlbGVtZW50OiBjb250YWluZXIsIHdpbmRvd1NpemV9KTtcblxuICBjb25zdCBzY3JvbGxEb3duID0gKHNjcm9sbFJhdGlvKSA9PiB7XG4gICAgaWYgKHNjcm9sbFJhdGlvID4gdHJlc2hvbGQpIHtcbiAgICAgIGNvbnN0IHRvQXBwZW5kID0gTWF0aC5mbG9vcih3aW5kb3dTaXplICogKDEgLSBzY3JvbGxSYXRpbykpO1xuICAgICAgY29uc3Qge3NoaWZ0LCBzbGljZTpub2Rlc30gPSBidWZmZXIuc2xpZGUodG9BcHBlbmQpO1xuICAgICAgaWYgKHNoaWZ0ICE9PSAwKSB7XG4gICAgICAgIGNvbnRhaW5lckludGVyZmFjZS5hcHBlbmQoLi4ubm9kZXMuc2xpY2UoLXNoaWZ0KS5tYXAobiA9PiBuLmRvbSgpKSk7XG4gICAgICB9XG4gICAgICBjb25zdCBwb3NpdGlvbiA9IGJ1ZmZlci5wb3NpdGlvbigpO1xuICAgICAgaWYgKHBvc2l0aW9uID4gYnVmZmVyUmVmcmVzaCAmJiBmZXRjaGluZyA9PT0gZmFsc2UpIHtcbiAgICAgICAgY29uc3QgdGFpbEluZGV4ID0gYnVmZmVyLnRhaWwoKS4kJGluZGV4O1xuICAgICAgICBmZXRjaGluZyA9IHRydWU7XG4gICAgICAgIHNvdXJjZVN0cmVhbS5wdWxsKHRhaWxJbmRleCArIDEsIGJ1ZmZlclJlZnJlc2hTaXplKVxuICAgICAgICAgIC50aGVuKGl0ZW1zID0+IHtcbiAgICAgICAgICAgIGJ1ZmZlci5wdXNoKC4uLml0ZW1zLm1hcChyb3dGYWN0b3J5KSk7XG4gICAgICAgICAgICBmZXRjaGluZyA9IGZhbHNlO1xuICAgICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBjb25zdCBzY3JvbGxVcCA9IChzY3JvbGxSYXRpbykgPT4ge1xuICAgIGlmIChzY3JvbGxSYXRpbyA8ICgxIC0gdHJlc2hvbGQpKSB7XG4gICAgICBjb25zdCB0b1ByZXBlbmQgPSBNYXRoLmZsb29yKHdpbmRvd1NpemUgKiAoMSAtIHRyZXNob2xkKSk7XG4gICAgICBjb25zdCB7c2hpZnQsIHNsaWNlOm5vZGVzfSA9IGJ1ZmZlci5zbGlkZSgtdG9QcmVwZW5kKTtcbiAgICAgIGlmIChzaGlmdCAhPT0gMCkge1xuICAgICAgICBjb250YWluZXJJbnRlcmZhY2UucHJlcGVuZCguLi5ub2Rlcy5zbGljZSgwLCAtc2hpZnQpXG4gICAgICAgICAgLnJldmVyc2UoKVxuICAgICAgICAgIC5tYXAobiA9PiBuLmRvbSgpKVxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgY29uc3QgcG9zaXRpb24gPSBidWZmZXIucG9zaXRpb24oKTtcbiAgICAgIGlmIChwb3NpdGlvbiA8IGJ1ZmZlclJlZnJlc2ggJiYgZmV0Y2hpbmcgPT09IGZhbHNlKSB7XG4gICAgICAgIGNvbnN0IGhlYWRJbmRleCA9IGJ1ZmZlci5oZWFkKCkuJCRpbmRleDtcbiAgICAgICAgY29uc3Qgc3RhcnRJbmRleCA9IE1hdGgubWF4KDAsIGhlYWRJbmRleCAtIGJ1ZmZlclJlZnJlc2hTaXplKTtcbiAgICAgICAgaWYgKHN0YXJ0SW5kZXggIT09IGhlYWRJbmRleCkge1xuICAgICAgICAgIGZldGNoaW5nID0gdHJ1ZTtcbiAgICAgICAgICBzb3VyY2VTdHJlYW0ucHVsbChzdGFydEluZGV4LCBidWZmZXJSZWZyZXNoU2l6ZSlcbiAgICAgICAgICAgIC50aGVuKGl0ZW1zID0+IHtcbiAgICAgICAgICAgICAgYnVmZmVyLnVuc2hpZnQoLi4uaXRlbXMubWFwKHJvd0ZhY3RvcnkpKTtcbiAgICAgICAgICAgICAgZmV0Y2hpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCdzY3JvbGwnLCAoKSA9PiB7XG4gICAgICBjb25zdCB7c2Nyb2xsSGVpZ2h0LCBzY3JvbGxUb3AsIG9mZnNldEhlaWdodH0gPSBjb250YWluZXI7XG4gICAgICBjb25zdCBzY3JvbGxSYXRpbyA9IChzY3JvbGxUb3AgKyBvZmZzZXRIZWlnaHQpIC8gc2Nyb2xsSGVpZ2h0O1xuXG4gICAgICBpZiAoYW50ZUxhc3RTY3JvbGwpIHtcbiAgICAgICAgY29uc3QgcHJldmlvdXNEaXJlY3Rpb24gPSAobGFzdFNjcm9sbCAtIGFudGVMYXN0U2Nyb2xsKSA+IDAgPyAnZG93bicgOiAndXAnO1xuICAgICAgICBjb25zdCBkaXJlY3Rpb24gPSBzY3JvbGxUb3AgLSBsYXN0U2Nyb2xsID4gMCA/ICdkb3duJyA6ICd1cCc7XG4gICAgICAgIGNvbnN0IGlzRGlyZWN0aW9uQ29uZmlybWVkID0gcHJldmlvdXNEaXJlY3Rpb24gPT09IGRpcmVjdGlvbjtcblxuICAgICAgICBpZiAoaXNEaXJlY3Rpb25Db25maXJtZWQpIHtcbiAgICAgICAgICBpZiAoZGlyZWN0aW9uID09PSAnZG93bicpIHtcbiAgICAgICAgICAgIHNjcm9sbERvd24oc2Nyb2xsUmF0aW8pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzY3JvbGxVcChzY3JvbGxSYXRpbyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBhbnRlTGFzdFNjcm9sbCA9IGxhc3RTY3JvbGw7XG4gICAgICBsYXN0U2Nyb2xsID0gc2Nyb2xsVG9wO1xuICAgIH1cbiAgKTtcblxuICB0YWJsZS5vbkRpc3BsYXlDaGFuZ2UoaXRlbXMgPT4ge1xuICAgIGNvbnRhaW5lckludGVyZmFjZS5lbXB0eSgpO1xuICAgIHNvdXJjZVN0cmVhbSA9IGRhdGFTb3VyY2Uoe3RhYmxlfSk7XG5cbiAgICAvL3RvZG8gY2xlYW4gb2xkIGJ1ZmZlclxuXG4gICAgYnVmZmVyID0gYnVmZmVyZWRXaW5kb3coe2J1ZmZlclNpemUsIHdpbmRvd1NpemV9KTtcbiAgICBidWZmZXIucHVzaCguLi5pdGVtcy5tYXAocm93RmFjdG9yeSkpO1xuXG4gICAgY29uc3Qge3NsaWNlOmluaXRpYWxOb2Rlc30gPSBidWZmZXIuc2xpZGUoMCk7XG4gICAgY29udGFpbmVySW50ZXJmYWNlLmFwcGVuZCguLi5pbml0aWFsTm9kZXMubWFwKG4gPT4gbi5kb20oKSkpO1xuXG4gICAgLy9zdGFydCB0byBmaWxsIHRoZSBidWZmZXJcbiAgICBzb3VyY2VTdHJlYW0ucHVsbChidWZmZXIubGVuZ3RoLCBidWZmZXJTaXplIC0gYnVmZmVyLmxlbmd0aClcbiAgICAgIC50aGVuKGl0ZW1zID0+IHtcbiAgICAgICAgYnVmZmVyLnB1c2goLi4uaXRlbXMubWFwKHJvd0ZhY3RvcnkpKTtcbiAgICAgICAgaWYgKGNvbnRhaW5lckludGVyZmFjZS5sZW5ndGggPCB3aW5kb3dTaXplKSB7XG4gICAgICAgICAgY29udGFpbmVySW50ZXJmYWNlLmVtcHR5KCk7XG4gICAgICAgICAgY29uc3Qge3NsaWNlOm5vZGVzfSA9IGJ1ZmZlci5zbGlkZSgwKTtcbiAgICAgICAgICBjb250YWluZXJJbnRlcmZhY2UuYXBwZW5kKC4uLm5vZGVzLm1hcChuID0+IG4uZG9tKCkpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH0pO1xufSIsImltcG9ydCB0YWJsZSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcbmltcG9ydCB2aXJ0dWFsaXplciBmcm9tICcuLi9pbmRleCc7XG5cblxuZnVuY3Rpb24gcm93RmFjdG9yeSAoe3ZhbHVlfSkge1xuICBjb25zdCB7bmFtZTp7Zmlyc3Q6Zmlyc3ROYW1lLCBsYXN0Omxhc3ROYW1lfSwgZ2VuZGVyLCBiaXJ0aERhdGUsIHNpemV9ID0gdmFsdWU7XG4gIGNvbnN0IHRyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnVFInKTtcbiAgdHIuaW5uZXJIVE1MID0gYDx0ZD4ke2xhc3ROYW1lfTwvdGQ+PHRkPiR7Zmlyc3ROYW1lfTwvdGQ+PHRkPiR7Z2VuZGVyfTwvdGQ+PHRkPiR7YmlydGhEYXRlLnRvTG9jYWxlRGF0ZVN0cmluZygpfTwvdGQ+PHRkPiR7c2l6ZX08L3RkPmA7XG4gIHJldHVybiB7XG4gICAgZG9tKCl7XG4gICAgICByZXR1cm4gdHI7XG4gICAgfSxcbiAgICBjbGVhbigpe1xuICAgIH1cbiAgfVxufVxuXG5jb25zdCB0ID0gdGFibGUoe1xuICBkYXRhLFxuICB0YWJsZVN0YXRlOiB7c29ydDoge30sIGZpbHRlcjoge30sIHNsaWNlOiB7cGFnZTogMSwgc2l6ZTogNTB9fVxufSk7XG5cbmNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ3Rib2R5Jyk7XG5cbnZpcnR1YWxpemVyKHtcbiAgdGFibGU6IHQsXG4gIHJvd0ZhY3RvcnksXG4gIGNvbnRhaW5lcixcbiAgLy8gYnVmZmVyU2l6ZTogMTAwMCxcbiAgLy8gd2luZG93U2l6ZTogMjAwLFxuICB0cmVzaG9sZDogMC43XG59KTtcblxudC5leGVjKCk7Il0sIm5hbWVzIjpbInBvaW50ZXIiLCJmaWx0ZXIiLCJzb3J0RmFjdG9yeSIsInNvcnQiLCJzZWFyY2giLCJ0YWJsZSIsInRhYmxlRGlyZWN0aXZlIl0sIm1hcHBpbmdzIjoiOzs7QUFBTyxTQUFTLElBQUksRUFBRSxDQUFDLEVBQUU7RUFDdkIsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztDQUMxQjs7QUFFRCxBQUFPLFNBQVMsT0FBTyxFQUFFLEtBQUssRUFBRSxHQUFHLEdBQUcsRUFBRTtFQUN0QyxPQUFPLENBQUMsR0FBRyxJQUFJLEtBQUssR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsRUFBRSxPQUFPLEtBQUssT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7Q0FDMUY7O0FBRUQsQUFBTyxTQUFTLEtBQUssRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFO0VBQ3BDLE1BQU0sS0FBSyxHQUFHLFNBQVMsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDO0VBQ3JDLE9BQU8sQ0FBQyxHQUFHLElBQUksS0FBSztJQUNsQixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUNuQyxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUU7TUFDdkIsT0FBTyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztLQUNwQixNQUFNO01BQ0wsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLFFBQVEsS0FBSyxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQztNQUN2RCxPQUFPLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFN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

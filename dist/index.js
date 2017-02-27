(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global['smart-table-virtualizer'] = factory());
}(this, (function () { 'use strict';

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

var index = function ({container, table, rowFactory, windowSize = 200, bufferSize = 1000, treshold = 0.8}) {
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

return index;

})));

import bufferFactory from './lib/itemsBuffer';
import containerFactory from './lib/window';
import dataSource from './lib/dataSource';
import {giveMeN} from './lib/helper';

export default function ({container, table, rowFactory, windowSize = 200, bufferSize = 1000, treshold = 0.7}) {
  const createRowObject = (item, index) => Object.assign({}, {row: rowFactory(item), index}, item);
  const containerInterface = containerFactory({element: container, windowSize});

  let buffer;
  let sourceStream;

  let anteLastScroll;
  let lastScroll;
  let lastScrollDirection;

  const scrollDown = () => {
    const {scrollHeight, scrollTop, offsetHeight} = container;
    const scrollRatio = (scrollTop + offsetHeight) / scrollHeight;

    if (scrollRatio > treshold) {
      const toAdd = Math.floor(windowSize * (1 - scrollRatio));
      const {index:tailIndex} = containerInterface.tail();//
      const toAppendItems = Array.from(buffer.slice(tailIndex, toAdd));//
      // window.slide(+toAdd)
      containerInterface.append(...toAppendItems);

      if (buffer.position(tailIndex) > (1 - treshold)) {
        const tailIndex = buffer.tail().index;
        sourceStream.pull(tailIndex, Math.ceil(bufferSize * (1 - treshold)))
          .then(items => {
            buffer.push(...items.map((item, index) => createRowObject(item, index + tailIndex)));
          });
      }

      //consistency between browsers: for some we need to manually reset scroll top
      // if (scrollTop === container.scrollTop) {
      //   container.scrollTop = averageItemHeight * (hiddenBeforeCount - toAppendItems.length);
      // }
    }
  };

  const scrollUp = () => {
    const {scrollHeight, scrollTop, offsetHeight} = container;
    const freeSpace = (scrollHeight - offsetHeight);
    const scrollRatio = (scrollTop) / freeSpace;
    const {index:headIndex} = containerInterface.head();
    const {index:bufferHeadIndex} = buffer.head();

    if (scrollRatio < (1 - treshold) && headIndex !== bufferHeadIndex) {
      const toAdd = Math.floor(windowSize * (1 - treshold - scrollRatio));
      console.log('head ' + headIndex);
      console.log('buffer head ' + bufferHeadIndex);
      console.log(buffer.length);
      const toPrependItems = Array.from(buffer.slice(Math.max(0, headIndex - toAdd), toAdd)).reverse();
      containerInterface.prepend(...toPrependItems);

      // if (buffer.position(windowTail.index) > (1 - treshold)) {
      //   const tailIndex = buffer.tail().index;
      //   sourceStream.pull(tailIndex, Math.ceil(bufferSize * (1 - treshold)))
      //     .then(items => {
      //       buffer.push(...items.map((item, index) => createRowObject(item, index + tailIndex)));
      //     });
      // }

      //consistency between browsers: for some we need to manually reset scroll top
      // if (scrollTop === container.scrollTop) {
      //   container.scrollTop = averageItemHeight * (hiddenBeforeCount - toPrependItems.length);
      // }
    }
  };

  container.addEventListener('scroll', (ev) => {

    // avoid noise in direction (ie jump in scrollBar when items are dropped/appended): what we want is a real trend
    const scrollTop = container.scrollTop;
    const scrollDirection = lastScroll && anteLastScroll && (scrollTop - lastScroll) < 0 ? 'up' : 'down';
    const confirmedDirection = scrollDirection === lastScrollDirection;

    anteLastScroll = lastScroll;
    lastScroll = scrollTop;
    lastScrollDirection = scrollDirection;

    if (confirmedDirection) {
      if (scrollDirection === 'down') {
        scrollDown();
      } else if (scrollDirection === 'up') {
        scrollUp();
      }
    }
  });

  table.onDisplayChange((items) => {
    containerInterface.empty();
    buffer = bufferFactory({capacity: bufferSize});
    sourceStream = dataSource({table});

    const newItems = items.map(createRowObject);

    buffer.push(...newItems);

    for (let i of giveMeN(windowSize)) {
      const item = buffer.get(i - 1);
      if (item) {
        containerInterface.append(item);
      }
    }

    //start to fill the buffer
    sourceStream.pull(buffer.length, bufferSize - buffer.length)
      .then(items => {
        buffer.push(...items.map((item, index) => createRowObject(item, index + buffer.length)));
        if (containerInterface.length < windowSize) {
          const slice = Array.from(buffer.slice(containerInterface.tail().index, windowSize - containerInterface.length));
          for (let i of slice) {
            containerInterface.append(i);
          }
        }
      });
  });
}
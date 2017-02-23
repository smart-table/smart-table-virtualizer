import dataSource from './lib/dataSource';
import slidingWindow from './lib/slidingWindow';
import containerFactory from './lib/container';

export default function ({container, table, rowFactory, indexKey = '$$index', windowSize = 200, bufferSize = 1000, treshold = 0.8}) {
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
}
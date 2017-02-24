import dataSource from './lib/dataSource';
import bufferedWindow from './lib/bufferedWindow';
import containerFactory from './lib/container';

export default function ({container, table, rowFactory, windowSize = 200, bufferSize = 1000, treshold = 0.8}) {
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
}
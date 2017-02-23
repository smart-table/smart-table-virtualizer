import zora from 'zora';
import helper from './helper';
import buffer from './itemsBuffer';
import dataSource from './dataSource';
import slidingWindow from './slidingWindow';

zora()
  .test(helper)
  // .test(buffer)
  .test(dataSource)
  .test(slidingWindow)
  .run();
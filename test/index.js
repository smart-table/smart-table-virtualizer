import zora from 'zora';
import helper from './helper';
import dataSource from './dataSource';
import buffer from './itemsBuffer';
import container from './container';

zora()
  .test(helper)
  .test(buffer)
  .test(dataSource)
  .test(container)
  .run();
import zora from 'zora';
import helper from './helper';
import dataSource from './dataSource';
import buffer from './itemsBuffer';

zora()
  .test(helper)
  .test(buffer)
  .test(dataSource)
  .run();
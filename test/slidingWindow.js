import zora from 'zora';
import {giveMeN} from '../lib/helper'
import slidingWindow from '../lib/slidingWindow';


export default zora()
  .test('sliding window: push new items setting indexes', function * (t) {
    const entries = Array.from(giveMeN(5)).map(i => Object.assign({}, {id: i}));
    const w = slidingWindow();
    w.push(...entries);
    t.equal(w.length, 5);
    t.deepEqual(w.get(2), {$$index: 2, id: 2});
    w.push({id: 666});
    t.deepEqual(w.get(5), {$$index: 5, id: 666});
  })
  .test('tail should return the last item or null', function * (t) {
    const w = slidingWindow();
    t.equal(w.tail(), null);
    w.push({id: 1}, {id: 2});
    t.deepEqual(w.tail(), {$$index: 1, id: 2});
  })
  .test('head should return the first item or null', function * (t) {
    const w = slidingWindow();
    t.equal(w.head(), null);
    w.push({id: 1}, {id: 2});
    t.deepEqual(w.head(), {$$index: 0, id: 1});
  })
import zora from 'zora';
import {giveMeN, doNTimes} from '../lib/helper';

export default zora()
  .test('give me n', function * (t) {
    const n = [...giveMeN(5)];
    t.deepEqual(n, [0, 1, 2, 3, 4,]);
  })
  .test('give me none', function * (t) {
    const n = [...giveMeN()];
    t.deepEqual(n, []);
  })
  .test('do n times', function * (t) {
    let counter = 0;
    doNTimes(() => counter++, 4);
    t.equal(counter, 4);
  })
  .test('do n times (curried)', function * (t) {
    let counter = 0;
    doNTimes(() => counter++)(4);
    t.equal(counter, 4);
  })
  .test('do once by default', function * (t) {
    let counter = 0;
    doNTimes(() => counter++)();
    t.equal(counter, 1);
  });
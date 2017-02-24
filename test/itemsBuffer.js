import zora from 'zora';
import buffer from '../lib/bufferedWindow';
import {giveMeN} from '../lib/helper';

const itemFactory = () => {

  let cleanedCount = 0;

  const factory = (item) => Object.assign({
    clean(){
      cleanedCount++;
    }
  }, item);

  Object.defineProperty(factory, 'cleaned', {
    get(){
      return cleanedCount
    }
  });

  return factory;
};

export default zora()
  .test('push multiple items', function * (t) {
    const factory = itemFactory();
    const b = buffer({bufferSize: 100, windowSize: 20});
    const items = [233, 455].map(id => factory({id}));
    b.push(...items);
    b.slide(0);
    t.equal(b.length, 2);
    items.forEach((item, index) => {
      const actual = b.get(index);
      const expected = items[index];
      t.equal(actual.$$index, index);
      t.equal(actual.id, expected.id);
    });
    b.push(factory({id: 22}));
    t.equal(b.get(2).id, 22);
  })
  .test('shift extra item when push exceed capacity', function * (t) {
    const factory = itemFactory();
    const b = buffer({bufferSize: 100, windowSize: 20});
    const items = [...giveMeN(100)].map((id) => ({id}));
    b.push(...items.map(factory));
    b.slide(5);
    t.equal(b.length, 100);
    b.push({id: 666});
    t.equal(b.length, 100);
    t.equal(b.tail().id, 666);
    t.equal(b.head().id, 1);
    t.equal(factory.cleaned, 1);
  })
  .test('shift items keeping window cursor constraint', function * (t) {
    const b = buffer({bufferSize: 100, windowSize: 20});
    const factory = itemFactory();
    const items = [...giveMeN(100)].map((id) => ({id}));
    b.push(...items.map(factory));
    b.slide(4);
    t.equal(b.length, 100);
    const newItems = [...giveMeN(10)].map(id => ({id: 600 + id}));
    b.push(...newItems);
    t.equal(b.length, 100);
    t.equal(b.tail().id, 603);
    t.equal(b.head().id, 4);
    t.equal(factory.cleaned, 4);
  })
  .test('move window up maximum to fit into buffer', function * (t) {
    const factory = itemFactory();
    const b = buffer({bufferSize: 100, windowSize: 20});
    const items = [...giveMeN(100)].map((id) => ({id}));
    b.push(...items.map(factory));
    const {slice, shift} = b.slide(90);
    t.equal(slice.length, 20);
    t.equal(slice[19].id, 99);
    t.equal(slice[0].id, 80);
    t.equal(shift, 80);
  })
  .test('move window down maximum to fit into buffer', function * (t) {
    const factory = itemFactory();
    const b = buffer({bufferSize: 100, windowSize: 20});
    const items = [...giveMeN(100)].map((id) => ({id}));
    b.push(...items.map(factory));
    const {slice, shift} = b.slide(50);
    t.equal(slice[19].id, 69);
    t.equal(slice[0].id, 50);
    t.equal(shift, 50);
    const {slice:sl, shift:sh} = b.slide(-100);
    t.equal(sl.length, 20);
    t.equal(sl[0].id, 0);
    t.equal(sl[19].id, 19);
    t.equal(sh, -50);
  })
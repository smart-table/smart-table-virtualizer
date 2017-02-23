import zora from 'zora';
import buffer from '../lib/itemsBuffer';

const itemFactory = (item) => {

  let cleaned = false;

  const row = {
    clean(){
      cleaned = true
    }
  };

  Object.defineProperty(row, 'cleaned', {
    get(){
      return cleaned;
    }
  });

  return {
    row,
    id:item.id
  };
};

export default zora()
  .test('clean item when pop', function * (t) {
    const b = buffer();
    const item = itemFactory({id: 666});
    b.push(item);
    t.equal(b.length, 1);
    t.equal(item.row.cleaned, false);
    b.pop();
    t.equal(b.length, 0);
    t.equal(item.row.cleaned, true);
  })
  .test('clean item when shift', function * (t) {
    const b = buffer();
    const item = itemFactory({id: 666});
    b.push(item);
    t.equal(b.length, 1);
    t.equal(item.row.cleaned, false);
    b.shift();
    t.equal(b.length, 0);
    t.equal(item.row.cleaned, true);
  })
  .test('push multiple items', function * (t) {
    const b = buffer();
    const items = [233, 455].map(id => itemFactory({id}));
    b.push(...items);
    t.equal(b.length, 2);
    items.forEach((item, index) => {
      t.deepEqual(b.get(index), items[index]);
    });
  })
  .test('unshift multiple items', function * (t) {
    const b = buffer();
    const items = [233, 455].map(id => itemFactory({id}));
    b.unshift(...items);
    t.equal(b.length, 2);
    items.forEach((item, index) => {
      t.deepEqual(b.get(index), items[index]);
    });
  })
  .test('shift extra item when push exceed capacity', function * (t) {
    const b = buffer({capacity: 1});
    const item1 = itemFactory({id: 1});
    const item2 = itemFactory({id: 2});
    b.push(item1);
    t.equal(b.length, 1);
    b.push(item2);
    t.equal(b.length, 1);
    t.equal(b.get(0), item2);
  })
  .test('pop extra item when unshift exceed capacity', function * (t) {
    const b = buffer({capacity: 1});
    const item1 = itemFactory({id: 1});
    const item2 = itemFactory({id: 2});
    b.unshift(item1);
    t.equal(b.length, 1);
    b.unshift(item2);
    t.equal(b.length, 1);
    t.equal(b.get(0), item2);
  })
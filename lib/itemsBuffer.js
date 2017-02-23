import {doNTimes} from './helper';

const eventuallyDo = (fn, val) => {
  if (val) {
    fn(val);
  }
};

export default function ({capacity = 1000} = {}) {
  const arrayBuffer = [];
  const instance = {
    pop: doNTimes(() => {
      eventuallyDo((item) => item.row.clean(), arrayBuffer.pop());
    }),
    shift: doNTimes(() => {
      eventuallyDo((item) => item.row.clean(), arrayBuffer.shift());
    }),
    unshift(){
      arrayBuffer.unshift(...arguments);
      eventuallyDo(instance.pop, Math.max(arrayBuffer.length - capacity, 0));
    },
    push(){
      arrayBuffer.push(...arguments);
      eventuallyDo(instance.shift, Math.max(arrayBuffer.length - capacity, 0));
    },
    get(index){
      return arrayBuffer.find(item => item.index === index);
    },
    slice: function * (start, n) {
      for (let i = 0; i < n; i++) {
        const item = instance.get(start + i);
        if (item) {
          yield item;
        }
      }
    },
    head(){
      return arrayBuffer[0];
    },
    tail(){
      return arrayBuffer[arrayBuffer.length - 1];
    },
    position(index){
      return arrayBuffer.indexOf(instance.get(index)) / arrayBuffer.length;
    }
  };

  Object.defineProperty(instance, 'length', {
    get: () => arrayBuffer.length
  });

  return instance;
}
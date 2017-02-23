export default function ({bufferSize = 600, windowSize = 200, indexKey = '$$index'} = {}) {

  const dataList = [];
  let windowCursor = null;

  const instance = {
    push(){
      const items = [...arguments];
      const tailItem = instance.tail();
      const index = tailItem ? tailItem[indexKey] + 1 : 0;
      dataList.push(...items.map((item, offset) => Object.assign({[indexKey]: index + offset}, item)));
    },
    unshift(...items){
      const items = [...arguments];
      const index = dataList.length ? dataList.length : 0;
      dataList.push(...items.map((item, offset) => Object.assign({[indexKey]: index + offset}, item)));
    },
    get(index){
      return dataList.find(item => item[indexKey] === index);
    },
    head(){
      return dataList[0] || null;
    },
    tail(){
      return dataList.length ? dataList[dataList.length - 1] : null;
    },
    slide(offset){
      const cursorIndex = dataList.indexOf(windowCursor) || 0;
      const index = Math.max(cursorIndex + offset, 0);
      const start = index + windowSize >= (bufferSize - 1) ? bufferSize - windowSize : index;
      const slice = dataList.slice(start, start + windowSize);
      const shift = start - cursorIndex;
      windowCursor = dataList[start];
      return {slice, shift};
    }
  };

  Object.defineProperty(instance, 'length', {
    get(){
      return dataList.length;
    }
  });


  return instance;


}
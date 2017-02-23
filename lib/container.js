import {doNTimes} from './helper'

export default function ({element, windowSize}) {

  const instance = {
    append(...args){
      for (let item of args) {
        element.appendChild(item);
        if (instance.length > windowSize) {
          instance.dropBegin(instance.length - windowSize);
        }
      }
    },
    prepend(...args){
      for (let item of args) {
        element.insertBefore(item, element.firstChild);
        if (instance.length > windowSize) {
          instance.dropEnd(instance.length - windowSize);
        }
      }
    },
    dropBegin: doNTimes(() => {
      const firstChild = element.firstChild;
      if (firstChild) {
        firstChild.remove();
      }
    }),
    dropEnd: doNTimes(() => {
      const lastChild = element.lastChild;
      if (lastChild) {
        lastChild.remove();
      }
    }),
    empty(){
      element.innerHTML = '';
    }
  };

  Object.defineProperty(instance, 'length', {
    get(){
      return element.children.length;
    }
  });

  return instance;
}
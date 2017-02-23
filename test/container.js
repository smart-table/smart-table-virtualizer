import zora from 'zora';

function elementFactory () {

  const children = [];
  const domElement = {
    appendChild(item){
      children.push(item);
    }
  };

  Object.defineProperty(domElement,'children',{value:children});

  return domElement
}

export default zora()
  .test('append n elements after', function * (t) {

  })
  .test('prepend n elements before', function * (t) {

  });
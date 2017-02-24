import zora from 'zora';
import container from '../lib/container';

function getElement () {
  return document.createElement('ul');
}

function li (id) {
  const l = document.createElement('li');
  l.id = id;
  return l;
}

function testElement (el, expected, assert) {
  const children = Array.from(el.children);
  children.forEach((child, index) => {
    assert.equal(child.id, expected[index]);
  });
}


export default zora()
  .test('append n elements after', function * (t) {
    const c = container({element: getElement(), windowSize: 5})

  })
  .test('prepend n elements before', function * (t) {

  });
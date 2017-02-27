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
    assert.equal(child.id, expected[index].toString());
  });
}

export default zora()
  .test('append n elements after', function * (t) {
    const element = getElement();
    const c = container({element, windowSize: 5});
    c.append(li(0));
    testElement(element, [0], t);
    c.append(...[1, 2, 3, 4].map(li));
    testElement(element, [0, 1, 2, 3, 4], t);
  })
  .test('append: drop element if over window size', function * (t) {
    const element = getElement();
    const c = container({element, windowSize: 5});
    c.append(li(0));
    testElement(element, [0], t);
    c.append(...[1, 2, 3, 4, 5, 6].map(li));
    testElement(element, [2, 3, 4, 5, 6], t);
  })
  .test('prepend n elements before', function * (t) {
    const element = getElement();
    const c = container({element, windowSize: 5});
    c.append(li(0));
    testElement(element, [0], t);
    c.prepend(...[4, 3, 2, 1].map(li));
    testElement(element, [1, 2, 3, 4, 0], t);
  })
  .test('prepend: drop element if over window size', function * (t) {
    const element = getElement();
    const c = container({element, windowSize: 5});
    c.append(li(0));
    testElement(element, [0], t);
    c.prepend(...[6, 5, 4, 3, 2, 1].map(li));
    testElement(element, [1, 2, 3, 4, 5], t);
  })
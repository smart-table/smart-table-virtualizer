import table from 'smart-table-core';
import virtualizer from '../indexBis';

function rowFactory (item) {
  const {index, value} = item;
  const li = document.createElement('LI');
  li.innerHTML = `id: ${value.id}; index ${index}`;
  return {
    dom(){
      return li;
    },
    clean(){
    }
  }
}

const data = [];

for (let i = 1; i <= 10000; i++) {
  data.push({id: i});
}

const t = table({
  data,
  tableState: {sort: {}, filter: {}, slice: {page: 1, size: 50}}
});

const container = document.getElementById('container');

virtualizer({
  table: t,
  rowFactory,
  container,
  // bufferSize: 800,
  // windowSize: 150,
  // indexKey: 'index',
  // treshold: 0.8
});

t.exec();
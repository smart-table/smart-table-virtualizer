import table from 'smart-table-core';
import virtualizer from '../index';

function rowFactory (item) {
  const {index, value} = item;
  const li = document.createElement('TR');
  li.innerHTML = `<td>${value.id}</td><td>${index}</td>`;
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

const container = document.querySelector('tbody');

virtualizer({
  table: t,
  rowFactory,
  container,
  // bufferSize: 1000,
  // windowSize: 200,
  treshold: 0.7
});

t.exec();
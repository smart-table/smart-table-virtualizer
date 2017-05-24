import table from 'smart-table-core';
import virtualizer from '../index';


function rowFactory ({value}) {
  const {name:{first:firstName, last:lastName}, gender, birthDate, size} = value;
  const tr = document.createElement('TR');
  tr.innerHTML = `<td>${lastName}</td><td>${firstName}</td><td>${gender}</td><td>${birthDate.toLocaleDateString()}</td><td>${size}</td>`;
  return {
    dom(){
      return tr;
    },
    clean(){
    }
  }
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
import zora from 'zora';
import dataSource from '../lib/dataSource';
import {default as createTable} from 'smart-table-core';

const dataSet = [
  {id: 1},
  {id: 2},
  {id: 3},
  {id: 4},
  {id: 5},
  {id: 6},
  {id: 7},
  {id: 8}
];
const initialTableState = {
  search: {},
  filter: {},
  sort: {},
  slice: {size: 2, page: 1}
};

export default zora()
  .test('pull data from data source from an offset to a given number based on the page size conf', function * (t) {
    const table = createTable({data: dataSet, tableState: initialTableState});
    const data = dataSource({table});
    const items = yield data.pull(1, 4);
    t.deepEqual(items, [
      {index: 1, value: {id: 2}},
      {index: 2, value: {id: 3}},
      {index: 3, value: {id: 4}},
      {index: 4, value: {id: 5}}
    ]);
  });

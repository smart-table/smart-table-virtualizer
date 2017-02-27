const node = require('rollup-plugin-node-resolve');
module.exports = {
  entry: './index.js',
  dest: './dist/index.js',
  format: 'umd',
  plugins: [node({jsnext: true})],
  moduleName: 'smart-table-virtualizer'
};

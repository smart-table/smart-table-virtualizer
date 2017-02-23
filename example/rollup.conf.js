const node = require('rollup-plugin-node-resolve');
// const commonjs = require('rollup-plugin-commonjs');
module.exports = {
  entry: 'example/index.js',
  dest: 'example/bundle.js',
  format: 'iife',
  plugins: [node({jsnext: true})],
  moduleName: 'tableExample',
  sourceMap: 'inline'
};

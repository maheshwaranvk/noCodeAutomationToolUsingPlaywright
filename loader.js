// Register path aliases at runtime
const { register } = require('tsconfig-paths');

const baseUrl = __dirname + '/dist';
const paths = {
  '@domain/*': ['domain/*'],
  '@application/*': ['application/*'],
  '@adapters/*': ['adapters/*'],
  '@infrastructure/*': ['infrastructure/*'],
  '@config/*': ['config/*']
};

register({
  baseUrl,
  paths
});

// Load the main app
require('./dist/index.js');

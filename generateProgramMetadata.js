const pkg = require('./package.json')
const fs = require('node:fs');

const content = `export const NAME = '${pkg.name}'
export const DESCRIPTION = '${pkg.description}'
export const DISPLAY_NAME = '${pkg.displayName}'
export const VERSION = '${pkg.version}'
export const AUTHOR = '${pkg.author}'
export const LICENSE = '${pkg.license}'`;

fs.writeFile('src/metadata.ts', content, err => {
  if (err) {
    console.error(err);
  } else {
    // done!
  }
});

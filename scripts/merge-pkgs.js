#!/usr/bin/env node

/* eslint import/no-dynamic-require: 0 */
/* eslint global-require: 0 */
/* eslint no-console: 0 */

if (process.argv.length < 4) {
  console.error('usage: ./merge-pkgs.js <path-to-output/package.json> <path-to-one-or-more/package.json> ... ');
  process.exit(1);
}

const { writeFileSync } = require('fs');
const { extname, join, resolve } = require('path');

const args = process.argv.slice(2);

function loadPkg(path) {
  let src = resolve('.', path);
  let loaded;
  try {
    if (extname(src) !== '.json') {
      src = join(src, 'package.json');
    }
    loaded = require(src);
  } catch (e) {
    console.log(`Cannot load package.json at pathname '${src}'`);
    process.exit(1);
  }
  return loaded;
}

let pkg = {};
let dest = resolve('.', args[0]);
for (let i = 1; i < args.length; i++) {
  const loaded = loadPkg(args[i]);
  // merge
  pkg = {
    name: loaded.name || pkg.name,
    version: loaded.version || pkg.version,
    description: loaded.description || pkg.description,
    author: loaded.author || pkg.author,
    main: (loaded.main && loaded.main.replace('dist/', '')) || pkg.main,
    bin: (loaded.bin && loaded.bin.deepstream && {
      deepstream: loaded.bin.deepstream.replace('dist/', ''),
    }) || pkg.bin,
    dependencies: Object.assign({}, pkg.dependencies, loaded.dependencies),
    // NOTE: we assume ./dist is not for development s no need for devDeps
    // devDependencies: Object.assign({}, pkg.devDependencies, loaded.devDependencies),
    repository: loaded.repository || pkg.repository,
    homepage: loaded.homepage || pkg.homepage,
    license: loaded.license || pkg.license,
  };
}

// start run script
pkg.scripts = {
  start: 'node ./bin/deepstream',
};


if (extname(dest) !== '.json') {
  dest = join(dest, 'package.json');
}

writeFileSync(dest, JSON.stringify(pkg, null, 2), 'utf8');

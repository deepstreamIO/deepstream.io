"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const os = require("os");
const glob = require("glob");
const jsYamlLoader = require("../src/config/js-yaml-loader");
exports.info = program => {
    program
        .command('info')
        .description('print meta information about build and runtime')
        .option('-c, --config [file]', 'configuration file containing lib directory')
        .option('-l, --lib-dir [directory]', 'directory of libraries')
        .action(printMeta);
};
function printMeta() {
    if (!this.libDir) {
        try {
            global.deepstreamCLI = this;
            jsYamlLoader.loadConfigWithoutInitialisation();
            this.libDir = global.deepstreamLibDir;
        }
        catch (e) {
            console.log(e);
            console.error('Please provide a libDir or a configFile to provide the relevant install information');
            process.exit(1);
        }
    }
    let meta;
    let pkg;
    try {
        meta = require('../meta.json');
    }
    catch (err) {
        // if deepstream is not installed as binary (source or npm)
        pkg = require('../package.json');
        meta = {
            deepstreamVersion: pkg.version,
            ref: pkg.gitHead || pkg._resolved || 'N/A',
            buildTime: 'N/A'
        };
    }
    meta.platform = os.platform();
    meta.arch = os.arch();
    meta.nodeVersion = process.version;
    fetchLibs(this.libDir, meta);
    console.log(JSON.stringify(meta, null, 2));
}
function fetchLibs(libDir, meta) {
    const directory = libDir || 'lib';
    const files = glob.sync(path.join(directory, '*', 'package.json'));
    meta.libs = files.map(filePath => {
        const pkg = fs.readFileSync(filePath, 'utf8');
        const object = JSON.parse(pkg);
        return `${object.name}:${object.version}`;
    });
}
//# sourceMappingURL=deepstream-info.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const installer_1 = require("./installer");
const jsYamlLoader = require("../src/config/js-yaml-loader");
exports.install = program => {
    program
        .command('install')
        .description('install connectors')
        .usage('<type> <name>[:version]')
        .option('-c, --config [file]', 'configuration file containing the lib directory')
        .option('-l, --lib-dir [directory]', 'directory where to extract the connector')
        .option('--verbose', 'more debug output')
        .option('--quiet', 'no output')
        .on('--help', () => {
        console.log('  Examples:');
        console.log('');
        console.log('    $ deepstream install cache redis');
        console.log('    $ deepstream install storage rethinkdb:0.1.0');
        console.log('');
        console.log('    list of available connectors: https://deepstream.io/download');
        console.log('');
    })
        .action(action);
};
function action(type, nameAndVersion) {
    const installArgs = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
    if (installArgs.length < 2) {
        this.help();
    }
    if (!this.libDir) {
        try {
            global.deepstreamCLI = this;
            jsYamlLoader.loadConfigWithoutInitialisation();
            this.libDir = global.deepstreamLibDir;
        }
        catch (e) {
            console.error('Please provide a libDir or a configFile to provide the relevant install information');
            process.exit(1);
        }
    }
    /*
       * Syntax:
       * TYPE NAME:VERSION
       * version is optional
       */
    type = installArgs[0];
    nameAndVersion = installArgs[1].split(':');
    const name = nameAndVersion[0];
    const version = nameAndVersion[1];
    if (this.quiet) {
        process.env.QUIET = '1';
    }
    else if (this.verbose) {
        process.env.VERBOSE = '1';
    }
    installer_1.installer({
        type,
        name,
        version,
        dir: this.libDir
    }, err => {
        if (err) {
            console.error(err.toString().red);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=deepstream-install.js.map
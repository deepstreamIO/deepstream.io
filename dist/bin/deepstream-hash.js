"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const file_based_authentication_handler_1 = require("../src/authentication/file-based-authentication-handler");
const jsYamlLoader = require("../src/config/js-yaml-loader");
exports.hash = program => {
    program
        .command('hash [password]')
        .description('Generate a hash from a plaintext password using file auth configuration settings')
        .option('-c, --config [file]', 'configuration file containing file auth and hash settings')
        .action(action);
};
function action(password) {
    global.deepstreamCLI = this;
    const config = jsYamlLoader.loadConfigWithoutInitialisation().config;
    if (config.auth.type !== 'file') {
        console.error('Error: Can only use hash with file authentication as auth type');
        process.exit(1);
    }
    if (!config.auth.options.hash) {
        console.error('Error: Can only use hash with file authentication');
        process.exit(1);
    }
    config.auth.options.path = '';
    if (!password) {
        console.error('Error: Must provide password to hash');
        process.exit(1);
    }
    // Mock file loading since a users.yml file is not required
    // jsYamlLoader.readAndParseFile = function () {}
    const fileAuthenticationHandler = new file_based_authentication_handler_1.default(config.auth.options);
    fileAuthenticationHandler.createHash(password, (err, passwordHash) => {
        if (err) {
            console.error('Hash could not be created', err);
            process.exit(1);
        }
        console.log('Password hash:', passwordHash);
    });
}
//# sourceMappingURL=deepstream-hash.js.map
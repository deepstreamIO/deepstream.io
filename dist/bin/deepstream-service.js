"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dsService = require("deepstream.io-service");
exports.service = program => {
    program
        .command('service [add|remove|start|stop|restart|status]')
        .description('Add, remove, start or stop deepstream as a service to your operating system')
        .option('-c, --config [file]', 'configuration file, parent directory will be used as prefix for other config files')
        .option('-n, --service-name <name>', 'the name to register the service')
        .option('-o, --log-dir <directory>', 'the directory for output logs')
        .option('-p, --pid-directory <directory>', 'the directory for the pid file')
        .option('--dry-run', 'outputs the service file to screen')
        .action(execute);
};
function response(error, result) {
    if (error) {
        console.log(error);
    }
    else {
        console.log(result);
    }
}
function execute(action) {
    const name = this.serviceName || 'deepstream';
    let exec;
    try {
        require('nexeres');
        exec = process.argv[0];
    }
    catch (e) {
        exec = process.argv[1];
    }
    if (action === 'add') {
        const options = {
            exec,
            programArgs: [],
            pidFile: this.pidFile || `/var/run/deepstream/${name}.pid`,
            logDir: this.logDir || '/var/log/deepstream',
            dryRun: this.dryRun
        };
        if (this.config) {
            options.programArgs.push('-c');
            options.programArgs.push(this.config);
        }
        dsService.add(name, options, response);
    }
    else if (action === 'remove') {
        dsService.remove(name, response);
    }
    else if (action === 'start') {
        dsService.start(name, response);
    }
    else if (action === 'stop') {
        dsService.stop(name, response);
    }
    else if (action === 'status') {
        dsService.status(name, response);
    }
    else if (action === 'restart') {
        dsService.restart(name, response);
    }
    else {
        console.log('Unknown action for service, please "add", "remove", "start", "stop", "restart" or "status"');
    }
}
//# sourceMappingURL=deepstream-service.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const std_out_logger_1 = require("../../src/default-plugins/std-out-logger");
const C = require("../../src/constants");
describe('logs to stdout and stderr', () => {
    const logger = new std_out_logger_1.default({ color: false });
    const originalStdOut = process.stdout;
    const originalStdErr = process.stderr;
    const stdout = jasmine.createSpy('stdout');
    const stderr = jasmine.createSpy('stderr');
    const comp = function (std, exp) {
        return std.calls.mostRecent().args[0].indexOf(exp) !== -1;
    };
    beforeAll(() => {
        Object.defineProperty(process, 'stdout', {
            value: { write: stdout }
        });
        Object.defineProperty(process, 'stderr', {
            value: { write: stderr }
        });
    });
    afterAll(() => {
        Object.defineProperty(process, 'stdout', {
            value: originalStdOut
        });
        Object.defineProperty(process, 'stderr', {
            value: originalStdErr
        });
    });
    it('creates the logger', () => {
        expect(logger.isReady).toBe(true);
        logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, 'b');
        expect(comp(stdout, 'INFO | b')).toBe(true);
    });
    it('logs to stderr', () => {
        stdout.calls.reset();
        stderr.calls.reset();
        logger.log(C.LOG_LEVEL.ERROR, C.EVENT.INFO, 'e');
        expect(stdout.calls.count()).toBe(0);
        expect(stderr.calls.count()).toBe(1);
    });
    it('logs above log level', () => {
        logger.setLogLevel(C.LOG_LEVEL.DEBUG);
        stdout.calls.reset();
        logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, 'e');
        expect(stdout.calls.count()).toBe(1);
        logger.setLogLevel(C.LOG_LEVEL.WARN);
        stdout.calls.reset();
        logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, 'e');
        expect(stdout.calls.count()).toBe(0);
    });
});
//# sourceMappingURL=std-out-loggerSpec.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const jsYamlLoader = require("../config/js-yaml-loader");
const configCompiler = require("./config-compiler");
const configValidator = require("./config-validator");
const rule_application_1 = require("./rule-application");
const rule_cache_1 = require("./rule-cache");
const rulesMap = require("./rules-map");
const UNDEFINED = 'undefined';
class ConfigPermissionHandler extends events_1.EventEmitter {
    /**
     * A permission handler that reads a rules config YAML or JSON, validates
     * its contents, compiles it and executes the permissions that it contains
     * against every incoming message.
     *
     * This is the standard permission handler that deepstream exposes, in conjunction
     * with the default permission.yml it allows everything, but at the same time provides
     * a convenient starting point for permission declarations.
     */
    constructor(config, services, permissions) {
        super();
        this.logger = services.logger;
        this.config = config;
        this.services = services;
        this.permissionOptions = config.permission.options;
        this.ruleCache = new rule_cache_1.default(this.permissionOptions);
        this.isReady = false;
        this.description = `valve permissions loaded from ${this.permissionOptions.path}`;
        this.optionsValid = true;
        const maxRuleIterations = config.permission.options.maxRuleIterations;
        if (maxRuleIterations !== undefined && maxRuleIterations < 1) {
            this.optionsValid = false;
            process.nextTick(() => this.emit('error', 'Maximum rule iteration has to be at least one '));
        }
        else if (permissions) {
            this.useConfig(permissions);
        }
    }
    /**
     * Will be invoked with the initialised recordHandler instance by deepstream.io
     */
    setRecordHandler(recordHandler) {
        this.recordHandler = recordHandler;
    }
    /**
     * Will be called by the dependency initialiser once server.start() is called.
     * This gives users a chance to change the path using server.set()
     * first
     */
    init() {
        if (!this.permissions && this.optionsValid) {
            this.loadConfig(this.permissionOptions.path);
        }
    }
    /**
     * Load a configuration file. This will either load a configuration file for the first time at
     * startup or reload the configuration at runtime
     *
     * CLI loadConfig <path>
     */
    loadConfig(filePath) {
        jsYamlLoader.readAndParseFile(filePath, this.onConfigLoaded.bind(this, filePath));
    }
    /**
     * Validates and compiles a loaded config. This can be called as the result
     * of a config being passed to the permissionHandler upon initialisation,
     * as a result of loadConfig or at runtime
     *
     * CLI useConfig <config>
     */
    useConfig(permissions) {
        const validationResult = configValidator.validate(permissions);
        if (validationResult !== true) {
            this.emit('error', `invalid permission config - ${validationResult}`);
            return;
        }
        this.permissions = configCompiler.compile(permissions);
        this.ruleCache.reset();
        this.ready();
    }
    /**
     * Implements the permissionHandler's canPerformAction interface
     * method
     *
     * This is the main entry point for permissionOperations and will
     * be called for every incoming message. This method executes four steps
     *
     * - Check if the incoming message conforms to basic specs
     * - Check if the incoming message requires permissions
     * - Load the applicable permissions
     * - Apply them
     */
    canPerformAction(username, message, callback, authData, socketWrapper) {
        const ruleSpecification = rulesMap.getRulesForMessage(message);
        if (ruleSpecification === null) {
            callback(null, true);
            return;
        }
        const ruleData = this.getCompiledRulesForName(message.name, ruleSpecification);
        if (!ruleData) {
            callback(null, false);
            return;
        }
        // tslint:disable-next-line
        new rule_application_1.default({
            recordHandler: this.recordHandler,
            socketWrapper,
            username,
            authData,
            path: ruleData,
            ruleSpecification,
            message,
            action: ruleSpecification.action,
            regexp: ruleData.regexp,
            rule: ruleData.rule,
            name: message.name,
            callback,
            logger: this.logger,
            permissionOptions: this.permissionOptions,
            config: this.config,
            services: this.services,
        });
    }
    /**
     * Evaluates the rules within a section and returns the matching rule for a path.
     * Takes basic specificity (as deduced from the path length) into account and
     * caches frequently used rules for faster access
     */
    getCompiledRulesForName(name, ruleSpecification) {
        if (this.ruleCache.has(ruleSpecification.section, name, ruleSpecification.type)) {
            return this.ruleCache.get(ruleSpecification.section, name, ruleSpecification.type);
        }
        const section = this.permissions[ruleSpecification.section];
        let i = 0;
        let pathLength = 0;
        let result = null;
        for (i; i < section.length; i++) {
            if (typeof section[i].rules[ruleSpecification.type] !== UNDEFINED &&
                section[i].path.length >= pathLength &&
                section[i].regexp.test(name)) {
                pathLength = section[i].path.length;
                result = {
                    path: section[i].path,
                    regexp: section[i].regexp,
                    rule: section[i].rules[ruleSpecification.type],
                };
            }
        }
        if (result) {
            this.ruleCache.set(ruleSpecification.section, name, ruleSpecification.type, result);
        }
        return result;
    }
    /**
     * Callback for loadConfig. Parses the incoming configuration string and forwards
     * it to useConfig if no errors occured
     */
    onConfigLoaded(filePath, loadError, permissions) {
        if (loadError) {
            this.emit('error', `error while loading config: ${loadError.toString()}`);
            return;
        }
        this.emit('config-loaded', filePath);
        this.useConfig(permissions);
    }
    /**
     * Sets this permissionHandler to ready. Occurs once the config has been successfully loaded,
     * parsed and compiled
     */
    ready() {
        if (this.isReady === false) {
            this.isReady = true;
            this.emit('ready');
        }
    }
}
exports.default = ConfigPermissionHandler;
//# sourceMappingURL=config-permission-handler.js.map
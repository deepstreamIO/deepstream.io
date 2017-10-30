"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
const OPEN = 'open';
const UNDEFINED = 'undefined';
const LOADING = 'loading';
const ERROR = 'error';
const STRING = 'string';
const os_1 = require("os");
const jsonPath = require("../record/json-path");
const record_request_1 = require("../record/record-request");
class RuleApplication {
    /**
     * This class handles the evaluation of a single rule. It creates
     * the required variables, injects them into the rule function and
     * runs the function recoursively until either all cross-references,
     * references to old or new data is loaded, it errors or the maxIterationCount
     * limit is exceeded
     */
    constructor(params) {
        this.params = params;
        this.isDestroyed = false;
        this.runScheduled = false;
        this.maxIterationCount = this.params.permissionOptions.maxRuleIterations;
        this.run = this.run.bind(this);
        this.crossReference = this.crossReference.bind(this);
        this.createNewRecordRequest = this.createNewRecordRequest.bind(this);
        this.pathVars = this.getPathVars();
        this.user = this.getUser();
        this.id = Math.random().toString();
        this.iterations = 0;
        this.recordsData = {};
        this.run();
    }
    /**
     * Runs the rule function. This method is initially called when this class
     * is constructed and recoursively from thereon whenever the loading of a record
     * is completed
     */
    run() {
        this.runScheduled = false;
        this.iterations++;
        if (this.isDestroyed) {
            return;
        }
        if (this.iterations > this.maxIterationCount) {
            this.onRuleError('Exceeded max iteration count');
            return;
        }
        const args = this.getArguments();
        let result;
        if (this.isDestroyed) {
            return;
        }
        try {
            result = this.params.rule.fn.apply({}, args);
        }
        catch (error) {
            if (this.isReady()) {
                this.onRuleError(error);
                return;
            }
        }
        if (this.isReady()) {
            this.params.callback(null, result);
            this.destroy();
        }
    }
    /**
     * Callback if a rule has irrecoverably errored. Rule errors due to unresolved
     * crossreferences are allowed as long as a loading step is in progress
     */
    onRuleError(error) {
        if (this.isDestroyed === true) {
            return;
        }
        const errorMsg = `error when executing ${this.params.rule.fn.toString()}${os_1.EOL}for ${this.params.path}: ${error.toString()}`;
        this.params.logger.warn(constants_1.AUTH_ACTIONS[constants_1.AUTH_ACTIONS.MESSAGE_PERMISSION_ERROR], errorMsg);
        this.params.callback(constants_1.AUTH_ACTIONS.MESSAGE_PERMISSION_ERROR, false);
        this.destroy();
    }
    /**
     * Called either asynchronously when data is successfully retrieved from the
     * cache or synchronously if its already present
     */
    onLoadComplete(data, recordName) {
        this.recordsData[recordName] = data;
        if (this.isReady()) {
            this.runScheduled = true;
            process.nextTick(this.run);
        }
    }
    /**
     * Called whenever a storage or cache retrieval fails. Any kind of error during the
     * permission process is treated as a denied permission
     */
    onLoadError(error, message, recordName) {
        this.recordsData[recordName] = ERROR;
        const errorMsg = `failed to load record ${this.params.name} for permissioning:${error.toString()}`;
        this.params.logger.error(constants_1.RECORD_ACTIONS[constants_1.RECORD_ACTIONS.RECORD_LOAD_ERROR], errorMsg);
        this.params.callback(constants_1.RECORD_ACTIONS.RECORD_LOAD_ERROR, false);
        this.destroy();
    }
    /**
     * Destroys this class and nulls down values to avoid
     * memory leaks
     */
    destroy() {
        this.params.recordHandler.removeRecordRequest(this.params.name);
        this.isDestroyed = true;
        this.runScheduled = false;
        // this.params = null
        // this.crossReference = null
        // this.recordsData = null
        // this.currentData = null
        this.pathVars = null;
        this.user = null;
    }
    /**
     * If data.someValue is used in the rule, this method retrieves or loads the
     * current data. This can mean different things, depending on the type of message
     *
     * the data arguments is supported for record read & write,
     * event publish and rpc request
     *
     * for event publish, record update and rpc request, the data is already provided
     * in the message and doesn't need to be loaded
     *
     * for record.patch, only a delta is part of the message. For the full data, the current value
     * is loaded and the patch applied on top
     */
    getCurrentData() {
        if (this.params.rule.hasData === false) {
            return null;
        }
        const msg = this.params.message;
        let result = false;
        if ((msg.topic === constants_1.TOPIC.RPC) ||
            (msg.topic === constants_1.TOPIC.EVENT && msg.data) ||
            (msg.topic === constants_1.TOPIC.RECORD && msg.action === constants_1.RECORD_ACTIONS.UPDATE)) {
            result = this.params.socketWrapper.parseData(msg);
            if (result instanceof Error) {
                this.onRuleError(`error when converting message data ${result.toString()}`);
            }
            else {
                return msg.parsedData;
            }
        }
        else if (msg.topic === constants_1.TOPIC.RECORD && msg.action === constants_1.RECORD_ACTIONS.PATCH) {
            result = this.getRecordPatchData(msg);
            if (result instanceof Error) {
                this.onRuleError(`error when converting message data ${result.toString()}`);
            }
            else {
                return result;
            }
        }
    }
    /**
     * Loads the records current data and applies the patch data onto it
     * to avoid users having to distuinguish between patches and updates
     */
    getRecordPatchData(msg) {
        if (!this.recordsData) {
            return;
        }
        if (!msg.path) {
            // TODO: Log error
            return;
        }
        const currentData = this.recordsData[this.params.name];
        const parseResult = this.params.socketWrapper.parseData(msg);
        let data;
        if (parseResult instanceof Error) {
            return parseResult;
        }
        if (currentData === null) {
            return new Error(`Tried to apply patch to non-existant record ${msg.name}`);
        }
        if (typeof currentData !== UNDEFINED && currentData !== LOADING) {
            data = JSON.parse(JSON.stringify(currentData._d));
            jsonPath.setValue(data, msg.path, msg.parsedData);
            return data;
        }
        this.loadRecord(this.params.name);
    }
    /**
     * Returns or loads the record's previous value. Only supported for record
     * write and read operations
     *
     * If getData encounters an error, the rule application might already be destroyed
     * at this point
     */
    getOldData() {
        if (this.isDestroyed === true || this.params.rule.hasOldData === false) {
            return;
        }
        const recordData = this.recordsData[this.params.name];
        if (typeof recordData !== UNDEFINED) {
            return recordData ? recordData._d : null;
        }
        this.loadRecord(this.params.name);
    }
    /**
     * Compile the list of arguments that will be injected
     * into the permission function. This method is called
     * everytime the permission is run. This allows it to merge
     * patches and update the now timestamp
     */
    getArguments() {
        return [
            this.crossReference,
            this.user,
            this.getCurrentData(),
            this.getOldData(),
            Date.now(),
            this.params ? this.params.action : null,
        ].concat(this.pathVars);
    }
    /**
     * Returns the data for the user variable. This is only done once
     * per rule as the user is not expected to change
     */
    getUser() {
        return {
            isAuthenticated: this.params.username !== OPEN,
            id: this.params.username,
            data: this.params.authData,
        };
    }
    /**
     * Applies the compiled regexp for the path and extracts
     * the variables that will be made available as $variableName
     * within the rule
     *
     * This is only done once per rule as the path is not expected
     * to change
     */
    getPathVars() {
        if (!this.params.name) {
            return [];
        }
        const matches = this.params.name.match(this.params.regexp);
        if (matches) {
            return matches.slice(1);
        }
        else {
            return [];
        }
    }
    /**
     * Returns true if all loading operations that are in progress have finished
     * and no run has been scheduled yet
     */
    isReady() {
        let isLoading = false;
        for (const key in this.recordsData) {
            if (this.recordsData[key] === LOADING) {
                isLoading = true;
            }
        }
        return isLoading === false && this.runScheduled === false;
    }
    /**
     * Loads a record with a given name. This will either result in
     * a onLoadComplete or onLoadError call. This method should only
     * be called if the record is not already being loaded or present,
     * but I'll leave the additional safeguards in until absolutely sure.
     */
    loadRecord(recordName) {
        /* istanbul ignore next */
        if (this.recordsData[recordName] === LOADING) {
            return;
        }
        /* istanbul ignore next */
        if (typeof this.recordsData[recordName] !== UNDEFINED) {
            this.onLoadComplete(this.recordsData[recordName], recordName);
            return;
        }
        this.recordsData[recordName] = LOADING;
        this.params.recordHandler.runWhenRecordStable(recordName, this.createNewRecordRequest);
    }
    /**
     * Load the record data from the cache for permissioning. This method should be
     * called once the record is stable – meaning there are no remaining writes
     * waiting to be written to the cache.
     */
    createNewRecordRequest(recordName) {
        record_request_1.default(recordName, this.params.config, this.params.services, null, this.onLoadComplete, this.onLoadError, this);
    }
    /**
     * This method is passed to the rule function as _ to allow crossReferencing
     * of other records. Cross-references can be nested, leading to this method
     * being recoursively called until the either all cross references are loaded
     * or the rule has finally failed
     */
    crossReference(recordName) {
        const type = typeof recordName;
        if (type !== UNDEFINED && type !== STRING) {
            this.onRuleError(`crossreference got unsupported type ${type}`);
        }
        else if (type === UNDEFINED || recordName.indexOf(UNDEFINED) !== -1) {
            return;
        }
        else if (this.recordsData[recordName] === LOADING) {
            return;
        }
        else if (this.recordsData[recordName] === null) {
            return null;
        }
        else if (typeof this.recordsData[recordName] === UNDEFINED) {
            this.loadRecord(recordName);
        }
        else {
            return this.recordsData[recordName]._d;
        }
    }
}
exports.default = RuleApplication;
//# sourceMappingURL=rule-application.js.map
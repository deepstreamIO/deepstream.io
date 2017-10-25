"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
const Ajv = require("ajv");
const utils = require("../utils/utils");
const jif_schema_1 = require("./jif-schema");
const ajv = new Ajv();
const validateJIF = ajv.compile(jif_schema_1.default);
// jif -> message lookup table
function getJifToMsg() {
    const JIF_TO_MSG = {};
    JIF_TO_MSG.event = {};
    JIF_TO_MSG.event.emit = msg => ({
        done: true,
        message: {
            topic: constants_1.TOPIC.EVENT,
            action: constants_1.EVENT_ACTIONS.EMIT,
            name: msg.eventName,
            parsedData: msg.data,
        },
    });
    JIF_TO_MSG.rpc = {};
    JIF_TO_MSG.rpc.make = msg => ({
        done: false,
        message: {
            topic: constants_1.TOPIC.RPC,
            action: constants_1.RPC_ACTIONS.REQUEST,
            name: msg.rpcName,
            correlationId: utils.getUid(),
            parsedData: msg.data,
        },
    });
    JIF_TO_MSG.record = {};
    JIF_TO_MSG.record.read = msg => ({
        done: false,
        message: {
            topic: constants_1.TOPIC.RECORD,
            action: constants_1.RECORD_ACTIONS.READ,
            name: msg.recordName,
        },
    });
    JIF_TO_MSG.record.write = msg => (msg.path ? JIF_TO_MSG.record.patch(msg) : JIF_TO_MSG.record.update(msg));
    JIF_TO_MSG.record.patch = msg => ({
        done: false,
        message: {
            topic: constants_1.TOPIC.RECORD,
            action: constants_1.RECORD_ACTIONS.CREATEANDUPDATE,
            name: msg.recordName,
            version: msg.version || -1,
            path: msg.path,
            parsedData: msg.data,
            isWriteAck: true,
        },
    });
    JIF_TO_MSG.record.update = msg => ({
        done: false,
        message: {
            topic: constants_1.TOPIC.RECORD,
            action: constants_1.RECORD_ACTIONS.CREATEANDUPDATE,
            name: msg.recordName,
            version: msg.version || -1,
            parsedData: msg.data,
            isWriteAck: true,
        },
    });
    JIF_TO_MSG.record.head = msg => ({
        done: false,
        message: {
            topic: constants_1.TOPIC.RECORD,
            action: constants_1.RECORD_ACTIONS.HEAD,
            name: msg.recordName,
        },
    });
    JIF_TO_MSG.record.delete = msg => ({
        done: false,
        message: {
            topic: constants_1.TOPIC.RECORD,
            action: constants_1.RECORD_ACTIONS.DELETE,
            name: msg.recordName,
        },
    });
    JIF_TO_MSG.list = {};
    JIF_TO_MSG.list.read = msg => ({
        done: false,
        message: {
            topic: constants_1.TOPIC.RECORD,
            action: constants_1.RECORD_ACTIONS.READ,
            name: msg.listName,
        },
    });
    JIF_TO_MSG.list.write = msg => ({
        done: false,
        message: {
            topic: constants_1.TOPIC.RECORD,
            action: constants_1.RECORD_ACTIONS.CREATEANDUPDATE,
            name: msg.listName,
            version: msg.version || -1,
            parsedData: msg.data,
            isWriteAck: true,
        },
    });
    JIF_TO_MSG.list.delete = msg => ({
        done: false,
        message: {
            topic: constants_1.TOPIC.RECORD,
            action: constants_1.RECORD_ACTIONS.DELETE,
            name: msg.listName,
        },
    });
    JIF_TO_MSG.presence = {};
    JIF_TO_MSG.presence.query = msg => (msg.parsedData ? JIF_TO_MSG.presence.queryUsers(msg) : JIF_TO_MSG.presence.queryAll(msg));
    JIF_TO_MSG.presence.queryAll = () => ({
        done: false,
        message: {
            topic: constants_1.TOPIC.PRESENCE,
            action: constants_1.PRESENCE_ACTIONS.QUERY_ALL,
        },
    });
    JIF_TO_MSG.presence.queryUsers = msg => ({
        done: false,
        message: {
            topic: constants_1.TOPIC.PRESENCE,
            action: constants_1.PRESENCE_ACTIONS.QUERY,
            data: msg.parsedData,
        },
    });
    return utils.deepFreeze(JIF_TO_MSG);
}
// message type enumeration
const TYPE = { ACK: 'A', NORMAL: 'N' };
function getMsgToJif() {
    // message -> jif lookup table
    const MSG_TO_JIF = {};
    MSG_TO_JIF[constants_1.TOPIC.RPC] = {};
    MSG_TO_JIF[constants_1.TOPIC.RPC][constants_1.RPC_ACTIONS.RESPONSE] = {};
    MSG_TO_JIF[constants_1.TOPIC.RPC][constants_1.RPC_ACTIONS.RESPONSE][TYPE.NORMAL] = message => ({
        done: true,
        message: {
            data: message.parsedData,
            success: true,
        },
    });
    MSG_TO_JIF[constants_1.TOPIC.RPC][constants_1.RPC_ACTIONS.ACCEPT] = {};
    MSG_TO_JIF[constants_1.TOPIC.RPC][constants_1.RPC_ACTIONS.ACCEPT][TYPE.NORMAL] = () => ({ done: false });
    MSG_TO_JIF[constants_1.TOPIC.RPC][constants_1.RPC_ACTIONS.REQUEST] = {};
    MSG_TO_JIF[constants_1.TOPIC.RPC][constants_1.RPC_ACTIONS.REQUEST][TYPE.ACK] = () => ({ done: false });
    MSG_TO_JIF[constants_1.TOPIC.RECORD] = {};
    MSG_TO_JIF[constants_1.TOPIC.RECORD][constants_1.RECORD_ACTIONS.READ_RESPONSE] = {};
    MSG_TO_JIF[constants_1.TOPIC.RECORD][constants_1.RECORD_ACTIONS.READ_RESPONSE][TYPE.NORMAL] = message => ({
        done: true,
        message: {
            version: message.version,
            data: message.parsedData,
            success: true,
        },
    });
    MSG_TO_JIF[constants_1.TOPIC.RECORD][constants_1.RECORD_ACTIONS.WRITE_ACKNOWLEDGEMENT] = {};
    MSG_TO_JIF[constants_1.TOPIC.RECORD][constants_1.RECORD_ACTIONS.WRITE_ACKNOWLEDGEMENT][TYPE.NORMAL] = message => ({
        done: true,
        message: {
            error: message.parsedData[1] || undefined,
            success: message.parsedData[1] === null,
        },
    });
    MSG_TO_JIF[constants_1.TOPIC.RECORD][constants_1.RECORD_ACTIONS.DELETE] = {};
    MSG_TO_JIF[constants_1.TOPIC.RECORD][constants_1.RECORD_ACTIONS.DELETE][TYPE.ACK] = () => ({
        done: true,
        message: {
            success: true,
        },
    });
    MSG_TO_JIF[constants_1.TOPIC.RECORD][constants_1.RECORD_ACTIONS.HEAD_RESPONSE] = {};
    MSG_TO_JIF[constants_1.TOPIC.RECORD][constants_1.RECORD_ACTIONS.HEAD_RESPONSE][TYPE.NORMAL] = message => ({
        done: true,
        message: {
            version: message.version,
            success: true,
        },
    });
    MSG_TO_JIF[constants_1.TOPIC.PRESENCE] = {};
    MSG_TO_JIF[constants_1.TOPIC.PRESENCE][constants_1.PRESENCE_ACTIONS.QUERY_ALL_RESPONSE] = {};
    MSG_TO_JIF[constants_1.TOPIC.PRESENCE][constants_1.PRESENCE_ACTIONS.QUERY_ALL_RESPONSE][TYPE.NORMAL] = message => ({
        done: true,
        message: {
            users: message.parsedData,
            success: true,
        },
    });
    MSG_TO_JIF[constants_1.TOPIC.PRESENCE][constants_1.PRESENCE_ACTIONS.QUERY_RESPONSE] = {};
    MSG_TO_JIF[constants_1.TOPIC.PRESENCE][constants_1.PRESENCE_ACTIONS.QUERY_RESPONSE][TYPE.NORMAL] = message => ({
        done: true,
        message: {
            users: message.parsedData,
            success: true,
        },
    });
    return utils.deepFreeze(MSG_TO_JIF);
}
class JIFHandler {
    constructor(options) {
        this.JIF_TO_MSG = getJifToMsg();
        this.MSG_TO_JIF = getMsgToJif();
        this.topicToKey = utils.reverseMap(constants_1.TOPIC);
        this.logger = options.logger;
    }
    /*
     * Validate and convert a JIF message to a deepstream message
     * @param {Object} jifMessage    JIF message
     *
     * @returns {Object} {
     *    {Boolean} success   true if the message passed validation
     *    {String}  error     if (!success), a description of the error that occurred
     *    {Object}  message   if (success) the deepstream message generated
     *    {Boolean} done      false iff message should await a result/acknowledgement
     * }
     */
    fromJIF(jifMessage) {
        if (!validateJIF(jifMessage)) {
            let error = validateJIF.errors[0];
            switch (error.keyword) {
                // case 'additionalProperties':
                //   error = `property '${error.params.additionalProperty}'
                //   not permitted for topic '${jifMessage.topic}'`
                //   break
                case 'required':
                    error = `property '${error.params.missingProperty}' is required for topic '${jifMessage.topic}'`;
                    break;
                case 'type':
                case 'minLength':
                    error = `property '${error.dataPath}' ${error.message}`;
                    break;
                // case 'const':
                //   error = `value for property '${error.dataPath}' not valid for topic '${jifMessage.topic}'`
                //   break
                default:
                    error = null;
            }
            return {
                success: false,
                error,
                done: true,
            };
        }
        const result = this.JIF_TO_MSG[jifMessage.topic][jifMessage.action](jifMessage);
        result.success = true;
        return result;
    }
    /*
     * Convert a deepstream response/ack message to a JIF message response
     * @param {Object}  message     deepstream message
     *
     * @returns {Object} {
     *    {Object}  message   jif message
     *    {Boolean} done      false iff message should await another result/acknowledgement
     * }
     */
    toJIF(message) {
        let type;
        if (message.isAck) {
            type = TYPE.ACK;
        }
        else {
            type = TYPE.NORMAL;
        }
        return this.MSG_TO_JIF[message.topic][message.action][type](message);
    }
    /*
     * Convert a deepstream error message to a JIF message response
     * @param {String}        topic     deepstream TOPIC
     * @param {String}        event     deepstream EVENT
     * @param {Array|String}  data   error message or data array
     *
     * @returns {Object} {
     *    {Object}  message   jif message
     *    {Boolean} done      false iff message should await another result/acknowledgement
     * }
     */
    errorToJIF(message, event) {
        // convert topic enum to human-readable key
        const topicKey = this.topicToKey[message.topic];
        const result = {
            errorTopic: topicKey && topicKey.toLowerCase(),
            errorEvent: event,
            success: false,
        };
        if (event === constants_1.AUTH_ACTIONS.MESSAGE_DENIED) {
            result.action = message.action;
            result.error = `Message denied. Action "${constants_1.ACTIONS[message.topic][message.action]}" is not permitted.`;
        }
        else if (event === constants_1.RECORD_ACTIONS.VERSION_EXISTS) {
            result.error = `Record update failed. Version ${message.version} exists for record "${message.name}".`;
            result.currentVersion = message.version;
            result.currentData = message.parsedData;
        }
        else if (event === constants_1.RECORD_ACTIONS.RECORD_NOT_FOUND) {
            result.error = `Record read failed. Record "${message.name}" could not be found.`;
            result.errorEvent = message.event;
        }
        else if (event === constants_1.RPC_ACTIONS.NO_RPC_PROVIDER) {
            result.error = `No provider was available to handle the RPC "${message.name}".`;
            // message.correlationId = data[1]
        }
        else if (message.topic === constants_1.TOPIC.RPC && event === constants_1.RPC_ACTIONS.RESPONSE_TIMEOUT) {
            result.error = 'The RPC response timeout was exceeded by the provider.';
        }
        else {
            this.logger.warn(constants_1.EVENT.INFO, `Unhandled request error occurred: ${constants_1.TOPIC[message.topic]} ${constants_1.EVENT[event]} ${JSON.stringify(message)}`);
            result.error = `An error occurred: ${constants_1.EVENT[event]}.`;
            result.errorParams = message.name;
        }
        return {
            message: result,
            done: true,
        };
    }
}
exports.default = JIFHandler;
//# sourceMappingURL=jif-handler.js.map
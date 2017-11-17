"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("./constants");
/**
 * This method tries to parse a value, and returns
 * an object containing the value or error.
 *
 * This is an optimization to avoid doing try/catch
 * inline since it incurs a massive performance hit
 * in most versions of node.
 */
function parseJSON(text, reviver) {
    try {
        return {
            value: JSON.parse(text, reviver),
        };
    }
    catch (err) {
        return {
            error: err,
        };
    }
}
const writeConfig = JSON.stringify({ writeSuccess: true });
exports.parse = rawMessage => {
    const parsedMessages = [];
    const rawMessages = rawMessage.split(constants_1.MESSAGE_SEPERATOR);
    for (let i = 0; i < rawMessages.length; i++) {
        if (rawMessages[i].length < 3) {
            continue;
        }
        const parts = rawMessages[i].split(constants_1.MESSAGE_PART_SEPERATOR);
        const topic = constants_1.TOPIC_TEXT_TO_BYTE[parts[0]];
        if (topic === undefined) {
            console.log('unknown topic', rawMessages[i]);
            // invalid topic
            continue;
        }
        let index = 1;
        let name;
        let data;
        let version;
        let path;
        let isWriteAck;
        let subscription;
        let correlationId;
        let isAck = false;
        let isError = false;
        if (parts[index] === 'A') {
            isAck = true;
            index++;
        }
        if (parts[index] === 'E') {
            isError = true;
            index++;
        }
        const A = constants_1.ACTIONS_TEXT_TO_BYTE[topic];
        const rawAction = parts[index++];
        let action = A[rawAction];
        if (action === undefined) {
            if ((isError && topic === constants_1.TOPIC.RPC.BYTE) ||
                (topic === constants_1.TOPIC.CONNECTION.BYTE && isAck) ||
                (topic === constants_1.TOPIC.AUTH.BYTE && (isError || isAck)) ||
                (isError && topic === constants_1.TOPIC.RECORD.BYTE)) {
                // ignore
            }
            else {
                console.log('unknown action', parts[index - 1], rawMessages[i]);
                continue;
            }
        }
        if (topic === constants_1.TOPIC.RECORD.BYTE) {
            /************************
            ***  RECORD
            *************************/
            name = parts[index++];
            if (isError) {
                isError = false;
                if (rawAction === 'VERSION_EXISTS') {
                    action = constants_1.RECORD_ACTIONS.VERSION_EXISTS.BYTE;
                    version = parts[index++] * 1;
                    data = parts[index++];
                    isWriteAck = parts.length - index > 1;
                }
                else if (rawAction === 'CACHE_RETRIEVAL_TIMEOUT') {
                    action = constants_1.RECORD_ACTIONS.CACHE_RETRIEVAL_TIMEOUT.BYTE;
                }
                else if (rawAction === 'STORAGE_RETRIEVAL_TIMEOUT') {
                    action = constants_1.RECORD_ACTIONS.STORAGE_RETRIEVAL_TIMEOUT.BYTE;
                }
            }
            else if (action === constants_1.RECORD_ACTIONS.CREATEANDUPDATE.BYTE ||
                action === constants_1.RECORD_ACTIONS.UPDATE.BYTE ||
                action === constants_1.RECORD_ACTIONS.PATCH.BYTE) {
                isWriteAck = (parts[parts.length - 1] === writeConfig);
                version = parts[index++] * 1;
                if (action === constants_1.RECORD_ACTIONS.CREATEANDUPDATE.BYTE && parts.length === 7) {
                    action = constants_1.RECORD_ACTIONS.CREATEANDPATCH.BYTE;
                }
                if (action === constants_1.RECORD_ACTIONS.CREATEANDPATCH.BYTE || action === constants_1.RECORD_ACTIONS.PATCH.BYTE) {
                    path = parts[index++];
                }
                if (parts.length - index === 2) {
                    data = parts[parts.length - 2];
                }
                else {
                    data = parts[index++];
                }
            }
            else if (action === constants_1.RECORD_ACTIONS.LISTEN_ACCEPT.BYTE ||
                action === constants_1.RECORD_ACTIONS.LISTEN_REJECT.BYTE ||
                action === constants_1.RECORD_ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND.BYTE ||
                action === constants_1.RECORD_ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED.BYTE) {
                subscription = parts[index++];
            }
            else if (action === constants_1.RECORD_ACTIONS.SUBSCRIPTION_HAS_PROVIDER.BYTE) {
                if (parts[index++] === 'F') {
                    action = constants_1.RECORD_ACTIONS.SUBSCRIPTION_HAS_NO_PROVIDER.BYTE;
                }
            }
        }
        else if (topic === constants_1.TOPIC.EVENT.BYTE) {
            /************************
            ***  EVENT
            *************************/
            name = parts[index++];
            if (action === constants_1.EVENT_ACTIONS.LISTEN_ACCEPT.BYTE ||
                action === constants_1.EVENT_ACTIONS.LISTEN_REJECT.BYTE ||
                action === constants_1.EVENT_ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND.BYTE ||
                action === constants_1.EVENT_ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED.BYTE) {
                subscription = parts[index++];
            }
            else if (action === constants_1.EVENT_ACTIONS.EMIT.BYTE) {
                data = parts[index++];
            }
        }
        else if (topic === constants_1.TOPIC.RPC.BYTE) {
            /************************
            ***  RPC
            *************************/
            name = parts[index++];
            if (isAck && action === constants_1.RPC_ACTIONS.REQUEST.BYTE) {
                isAck = false;
                action = constants_1.RPC_ACTIONS.ACCEPT.BYTE;
            }
            if (isError) {
                isError = false;
                action = constants_1.RPC_ACTIONS.REQUEST_ERROR.BYTE;
                data = rawAction;
            }
            if (action !== constants_1.RPC_ACTIONS.PROVIDE.BYTE && action !== constants_1.RPC_ACTIONS.UNPROVIDE.BYTE) {
                correlationId = parts[index++];
            }
            if (action === constants_1.RPC_ACTIONS.RESPONSE.BYTE || action === constants_1.RPC_ACTIONS.REQUEST.BYTE) {
                data = parts[index++];
            }
        }
        else if (topic === constants_1.TOPIC.PRESENCE.BYTE) {
            /************************
            ***  Presence
            *************************/
            if (action === constants_1.PRESENCE_ACTIONS.QUERY.BYTE) {
                if (parts.length === 3) {
                    action = constants_1.PRESENCE_ACTIONS.QUERY_ALL.BYTE;
                }
                else {
                    correlationId = parts[index++];
                    data = parts[index++];
                }
            }
            else if (action === constants_1.PRESENCE_ACTIONS.SUBSCRIBE.BYTE || action === constants_1.PRESENCE_ACTIONS.UNSUBSCRIBE.BYTE) {
                if (parts.length === 4 && !isAck) {
                    correlationId = parts[index++];
                }
                data = parts[index++];
            }
        }
        else if (topic === constants_1.TOPIC.CONNECTION.BYTE) {
            /************************
            ***  Connection
            *************************/
            if (action === constants_1.CONNECTION_ACTIONS.PONG.BYTE) {
                continue;
            }
            if (isAck) {
                action = constants_1.CONNECTION_ACTIONS.ACCEPT.BYTE;
                isAck = false;
            }
            else if (action === constants_1.CONNECTION_ACTIONS.CHALLENGE_RESPONSE.BYTE || action === constants_1.CONNECTION_ACTIONS.REDIRECT.BYTE || action === constants_1.CONNECTION_ACTIONS.REJECTION.BYTE) {
                data = parts[index++];
            }
        }
        else if (topic === constants_1.TOPIC.AUTH.BYTE) {
            /************************
            ***  Authentication
            *************************/
            if (isAck) {
                action = constants_1.AUTH_ACTIONS.AUTH_SUCCESSFUL.BYTE;
            }
            else if (isError) {
                if (rawAction === 'INVALID_AUTH_DATA') {
                    isError = false;
                    action = constants_1.AUTH_ACTIONS.AUTH_UNSUCCESSFUL.BYTE;
                }
                else if (rawAction === 'TOO_MANY_AUTH_ATTEMPTS') {
                    isError = false;
                    action = constants_1.AUTH_ACTIONS.TOO_MANY_AUTH_ATTEMPTS.BYTE;
                }
            }
            if (action === constants_1.AUTH_ACTIONS.AUTH_SUCCESSFUL.BYTE) {
                isAck = false;
                data = rawAction;
            }
            else if (action === constants_1.AUTH_ACTIONS.REQUEST.BYTE || action === constants_1.AUTH_ACTIONS.AUTH_UNSUCCESSFUL.BYTE) {
                data = parts[index++];
            }
        }
        parsedMessages.push(JSON.parse(JSON.stringify({
            isAck,
            isError,
            topic,
            action,
            name,
            data,
            // rpc / presence query
            correlationId,
            // subscription by listening
            subscription,
            // record
            path,
            version,
            // parsedData: null,
            isWriteAck,
        })));
    }
    return parsedMessages;
};
exports.parseData = message => {
    if (message.parsedData || !message.data) {
        return true;
    }
    if (constants_1.ACTIONS_BYTE_TO_PAYLOAD[message.topic][message.action] === constants_1.PAYLOAD_ENCODING.DEEPSTREAM) {
        const parsedData = exports.convertTyped(message.data);
        if (parsedData instanceof Error) {
            return parsedData;
        }
        message.parsedData = parsedData;
        return true;
    }
    else {
        const res = parseJSON(message.data);
        if (res.error) {
            return res.error;
        }
        message.parsedData = res.value;
        return true;
    }
};
/**
 * Deserializes values created by MessageBuilder.typed to
 * their original format
 */
exports.convertTyped = (value) => {
    const type = value.charAt(0);
    if (type === constants_1.DEEPSTREAM_TYPES.STRING) {
        return value.substr(1);
    }
    if (type === constants_1.DEEPSTREAM_TYPES.OBJECT) {
        const result = parseJSON(value.substr(1));
        if (result.value) {
            return result.value;
        }
        return result.error;
    }
    if (type === constants_1.DEEPSTREAM_TYPES.NUMBER) {
        return parseFloat(value.substr(1));
    }
    if (type === constants_1.DEEPSTREAM_TYPES.NULL) {
        return null;
    }
    if (type === constants_1.DEEPSTREAM_TYPES.TRUE) {
        return true;
    }
    if (type === constants_1.DEEPSTREAM_TYPES.FALSE) {
        return false;
    }
    if (type === constants_1.DEEPSTREAM_TYPES.UNDEFINED) {
        return undefined;
    }
    return new Error('Unknown type');
};
//# sourceMappingURL=message-parser.js.map
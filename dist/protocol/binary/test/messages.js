"use strict";
/* tslint:disable:no-bitwise */
Object.defineProperty(exports, "__esModule", { value: true });
const message_constants_1 = require("../src/message-constants");
function m(data) {
    data.message = Object.assign({
        isAck: false,
        isError: false,
    }, data.message);
    if (data.message.parsedData) {
        data.message.data = Buffer.from(JSON.stringify(data.message.parsedData), 'utf8');
    }
    return data;
}
function binMsg(topicByte, actionByte, meta, payload, fin = true) {
    if (typeof meta === 'object') {
        meta = JSON.stringify(meta);
    }
    let payloadBuff;
    if (payload instanceof Buffer) {
        payloadBuff = payload;
    }
    else {
        if (typeof payload === 'object') {
            payload = JSON.stringify(payload);
        }
        payloadBuff = Buffer.from(payload, 'utf8');
    }
    const metaLen = Buffer.byteLength(meta);
    const payloadLen = payloadBuff.length;
    return Buffer.concat([
        Buffer.from([
            (fin ? 0x80 : 0x00) | topicByte,
            actionByte,
            metaLen >> 16,
            metaLen >> 8,
            metaLen,
            payloadLen >> 16,
            payloadLen >> 8,
            payloadLen,
        ]),
        Buffer.from(meta, 'utf8'),
        payloadBuff,
    ]);
}
function extendWithSubscriptionMessages(topic, actions, messages) {
    Object.assign(messages, {
        SUBSCRIBE: m({
            message: {
                topic,
                action: actions.SUBSCRIBE,
                name: 'subscription',
            },
            urp: {
                value: binMsg(topic, actions.SUBSCRIBE, { n: 'subscription' }, ''),
                args: ['name'],
                payload: null,
                description: 'Sent to subscribe to a given name',
                source: 'client'
            }
        }),
        SUBSCRIBE_ACK: m({
            message: {
                isAck: true,
                topic,
                action: actions.SUBSCRIBE,
                name: 'subscription',
            },
            urp: {
                value: binMsg(topic, actions.SUBSCRIBE_ACK, { n: 'subscription' }, ''),
                args: ['name'],
                payload: null,
                description: 'Sent when a \'SUBSCRIBE\' message is permissioned and the subscription registered,',
                source: 'server'
            }
        }),
        UNSUBSCRIBE: m({
            message: {
                topic,
                action: actions.UNSUBSCRIBE,
                name: 'subscription',
            },
            urp: {
                value: binMsg(topic, actions.UNSUBSCRIBE, { n: 'subscription' }, ''),
                args: ['name'],
                payload: null,
                description: 'Sent to unsubscribe to a given name',
                source: 'client'
            }
        }),
        UNSUBSCRIBE_ACK: m({
            message: {
                isAck: true,
                topic,
                action: actions.UNSUBSCRIBE,
                name: 'subscription',
            },
            urp: {
                value: binMsg(topic, actions.UNSUBSCRIBE_ACK, { n: 'subscription' }, ''),
                args: ['name'],
                payload: null,
                description: 'Sent when an \'UNSUBSCRIBE\' message is permissioned and the subscription deregistered,',
                source: 'server'
            }
        }),
        MULTIPLE_SUBSCRIPTIONS: m({
            message: {
                isError: true,
                topic,
                action: actions.MULTIPLE_SUBSCRIPTIONS,
                name: 'username',
            },
            urp: {
                value: binMsg(topic, actions.MULTIPLE_SUBSCRIPTIONS, { n: 'username' }, ''),
                args: ['name'],
                payload: null,
                description: 'Sent in response to a \'SUBSCRIBE\' message if the subscription already exists',
                source: 'server'
            }
        }),
        NOT_SUBSCRIBED: m({
            message: {
                isError: true,
                topic,
                action: actions.NOT_SUBSCRIBED,
                name: 'username',
            },
            urp: {
                value: binMsg(topic, actions.NOT_SUBSCRIBED, { n: 'username' }, ''),
                args: ['name'],
                payload: null,
                description: 'Sent in response to an \'UNSUBSCRIBE\' message if the subscription does not already exist',
                source: 'server'
            }
        }),
    });
}
function extendWithListenMessages(topic, actions, messages) {
    Object.assign(messages, {
        LISTEN: m({
            message: {
                topic,
                action: actions.LISTEN,
                name: '.*',
            },
            urp: {
                value: binMsg(topic, actions.LISTEN, { n: '.*' }, ''),
                args: ['name'],
                payload: null,
            }
        }),
        LISTEN_ACK: m({
            message: {
                isAck: true,
                topic,
                action: actions.LISTEN,
                name: '.*',
            },
            urp: {
                value: binMsg(topic, actions.LISTEN_ACK, { n: '.*' }, ''),
                args: ['name'],
                payload: null,
            }
        }),
        UNLISTEN: m({
            message: {
                topic,
                action: actions.UNLISTEN,
                name: '.*',
            },
            urp: {
                value: binMsg(topic, actions.UNLISTEN, { n: '.*' }, ''),
                args: ['name'],
                payload: null,
            }
        }),
        UNLISTEN_ACK: m({
            message: {
                isAck: true,
                topic,
                action: actions.UNLISTEN,
                name: '.*',
            },
            urp: {
                value: binMsg(topic, actions.UNLISTEN_ACK, { n: '.*' }, ''),
                args: ['name'],
                payload: null,
            }
        }),
        SUBSCRIPTION_FOR_PATTERN_FOUND: m({
            message: {
                topic,
                action: actions.SUBSCRIPTION_FOR_PATTERN_FOUND,
                name: '.*',
                subscription: 'someSubscription',
            },
            urp: {
                value: binMsg(topic, actions.SUBSCRIPTION_FOR_PATTERN_FOUND, { n: '.*', s: 'someSubscription' }, ''),
                args: ['name', 'subscription'],
                payload: null,
            }
        }),
        SUBSCRIPTION_FOR_PATTERN_REMOVED: m({
            message: {
                topic,
                action: actions.SUBSCRIPTION_FOR_PATTERN_REMOVED,
                name: '.*',
                subscription: 'someSubscription',
            },
            urp: {
                value: binMsg(topic, actions.SUBSCRIPTION_FOR_PATTERN_REMOVED, { n: '.*', s: 'someSubscription' }, ''),
                args: ['name', 'subscription'],
                payload: null,
            }
        }),
        LISTEN_ACCEPT: m({
            message: {
                topic,
                action: actions.LISTEN_ACCEPT,
                name: '.*',
                subscription: 'someSubscription',
            },
            urp: {
                value: binMsg(topic, actions.LISTEN_ACCEPT, { n: '.*', s: 'someSubscription' }, ''),
                args: ['name', 'subscription'],
                payload: null,
            }
        }),
        LISTEN_REJECT: m({
            message: {
                topic,
                action: actions.LISTEN_REJECT,
                name: '.*',
                subscription: 'someSubscription',
            },
            urp: {
                value: binMsg(topic, actions.LISTEN_REJECT, { n: '.*', s: 'someSubscription' }, ''),
                args: ['name', 'subscription'],
                payload: null,
            }
        }),
        INVALID_LISTEN_REGEX: m({
            message: {
                isError: true,
                topic,
                action: actions.INVALID_LISTEN_REGEX,
                name: '*',
            },
            urp: {
                value: binMsg(topic, actions.INVALID_LISTEN_REGEX, { n: '*' }, ''),
                args: ['name'],
                payload: null,
            }
        }),
    });
}
exports.PARSER_MESSAGES = {
    UNKNOWN_TOPIC: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.PARSER,
            action: message_constants_1.PARSER_ACTIONS.UNKNOWN_TOPIC,
            originalTopic: 0x25
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PARSER, message_constants_1.PARSER_ACTIONS.UNKNOWN_TOPIC, { t: 0x25 }, ''),
            args: [],
            payload: null,
        }
    }),
    UNKNOWN_ACTION: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.PARSER,
            action: message_constants_1.PARSER_ACTIONS.UNKNOWN_ACTION,
            originalTopic: message_constants_1.TOPIC.EVENT,
            originalAction: 0x52
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PARSER, message_constants_1.PARSER_ACTIONS.UNKNOWN_ACTION, { t: message_constants_1.TOPIC.EVENT, a: 0x52 }, ''),
            args: [],
            payload: null,
        }
    }),
    INVALID_MESSAGE: m({
        message: {
            topic: message_constants_1.TOPIC.PARSER,
            action: message_constants_1.PARSER_ACTIONS.INVALID_MESSAGE,
            isError: true
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PARSER, message_constants_1.PARSER_ACTIONS.INVALID_MESSAGE, '', ''),
            args: [],
            payload: null,
        }
    }),
    MESSAGE_PARSE_ERROR: m({
        message: {
            topic: message_constants_1.TOPIC.PARSER,
            action: message_constants_1.PARSER_ACTIONS.MESSAGE_PARSE_ERROR,
            isError: true,
            data: Buffer.from([0xE, 0xE, 0xE, 0xE, 0xE, 0xE, 0xE, 0xE]),
            payloadEncoding: message_constants_1.PAYLOAD_ENCODING.BINARY,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PARSER, message_constants_1.PARSER_ACTIONS.MESSAGE_PARSE_ERROR, '', Buffer.from([0xE, 0xE, 0xE, 0xE, 0xE, 0xE, 0xE, 0xE])),
            args: [],
            payload: 'rawMessage',
        }
    }),
    INVALID_META_PARAMS: m({
        message: {
            topic: message_constants_1.TOPIC.PARSER,
            action: message_constants_1.PARSER_ACTIONS.INVALID_META_PARAMS,
            isError: true,
            originalTopic: message_constants_1.TOPIC.RECORD,
            originalAction: message_constants_1.RECORD_ACTIONS.READ,
            data: new Buffer('{"r":"too', 'utf8'),
            payloadEncoding: message_constants_1.PAYLOAD_ENCODING.BINARY,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PARSER, message_constants_1.PARSER_ACTIONS.INVALID_META_PARAMS, { t: message_constants_1.TOPIC.RECORD, a: message_constants_1.RECORD_ACTIONS.READ }, '{"r":"too'),
            args: ['parsedTopic', 'parsedAction'],
            payload: 'rawMeta',
        }
    }),
    MAXIMUM_MESSAGE_SIZE_EXCEEDED: m({
        message: {
            topic: message_constants_1.TOPIC.PARSER,
            action: message_constants_1.PARSER_ACTIONS.MAXIMUM_MESSAGE_SIZE_EXCEEDED,
            isError: true
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PARSER, message_constants_1.PARSER_ACTIONS.MAXIMUM_MESSAGE_SIZE_EXCEEDED, '', ''),
            args: [],
            payload: null,
        }
    }),
    ERROR: null
};
exports.CONNECTION_MESSAGES = {
    PING: m({
        message: {
            topic: message_constants_1.TOPIC.CONNECTION,
            action: message_constants_1.CONNECTION_ACTIONS.PING
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.CONNECTION, message_constants_1.CONNECTION_ACTIONS.PING, '', ''),
            args: [],
            payload: null,
            description: 'Sent periodically to ensure a live connection',
            source: 'server'
        },
    }),
    PONG: m({
        message: {
            topic: message_constants_1.TOPIC.CONNECTION,
            action: message_constants_1.CONNECTION_ACTIONS.PONG
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.CONNECTION, message_constants_1.CONNECTION_ACTIONS.PONG, '', ''),
            args: [],
            payload: null,
            description: 'Sent immediately in response to a \'Ping\' message',
            source: 'client'
        }
    }),
    CHALLENGE: m({
        message: {
            topic: message_constants_1.TOPIC.CONNECTION,
            action: message_constants_1.CONNECTION_ACTIONS.CHALLENGE,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.CONNECTION, message_constants_1.CONNECTION_ACTIONS.CHALLENGE, '', ''),
            args: [],
            payload: null,
            description: 'Sent as soon as a connection is established',
            source: 'server'
        }
    }),
    CHALLENGE_RESPONSE: m({
        message: {
            topic: message_constants_1.TOPIC.CONNECTION,
            action: message_constants_1.CONNECTION_ACTIONS.CHALLENGE_RESPONSE,
            url: 'ws://url.io',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.CONNECTION, message_constants_1.CONNECTION_ACTIONS.CHALLENGE_RESPONSE, { u: 'ws://url.io' }, ''),
            args: ['url'],
            payload: null,
            description: 'Sent when a \'Connection Challenge\' is received',
            source: 'client'
        }
    }),
    ACCEPT: m({
        message: {
            topic: message_constants_1.TOPIC.CONNECTION,
            action: message_constants_1.CONNECTION_ACTIONS.ACCEPT,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.CONNECTION, message_constants_1.CONNECTION_ACTIONS.ACCEPT, '', ''),
            args: [],
            payload: null,
            description: 'Sent in response to a \'Challenge Response\' if the requested URL is valid',
            source: 'server'
        }
    }),
    REJECT: m({
        message: {
            topic: message_constants_1.TOPIC.CONNECTION,
            action: message_constants_1.CONNECTION_ACTIONS.REJECT,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.CONNECTION, message_constants_1.CONNECTION_ACTIONS.REJECT, '', ''),
            args: [],
            payload: null,
            description: 'Sent in response to a \'Challenge Response\' if the requested URL is invalid',
            source: 'server'
        }
    }),
    REDIRECT: m({
        message: {
            topic: message_constants_1.TOPIC.CONNECTION,
            action: message_constants_1.CONNECTION_ACTIONS.REDIRECT,
            url: 'ws://url.io',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.CONNECTION, message_constants_1.CONNECTION_ACTIONS.REDIRECT, { u: 'ws://url.io' }, ''),
            args: ['url'],
            payload: null,
            description: 'Sent to redirect a client to a different url',
            source: 'server'
        }
    }),
    CLOSING: m({
        message: {
            topic: message_constants_1.TOPIC.CONNECTION,
            action: message_constants_1.CONNECTION_ACTIONS.CLOSING,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.CONNECTION, message_constants_1.CONNECTION_ACTIONS.CLOSING, '', ''),
            args: [],
            payload: null,
            description: 'Sent to server when closing the connection',
            source: 'client'
        }
    }),
    CLOSED: m({
        message: {
            topic: message_constants_1.TOPIC.CONNECTION,
            action: message_constants_1.CONNECTION_ACTIONS.CLOSED,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.CONNECTION, message_constants_1.CONNECTION_ACTIONS.CLOSED, '', ''),
            args: [],
            payload: null,
            description: 'Sent to client when acknowledging graceful close',
            source: 'server'
        }
    }),
    ERROR: null,
    AUTHENTICATION_TIMEOUT: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.CONNECTION,
            action: message_constants_1.CONNECTION_ACTIONS.AUTHENTICATION_TIMEOUT,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.CONNECTION, message_constants_1.CONNECTION_ACTIONS.AUTHENTICATION_TIMEOUT, '', ''),
            args: [],
            payload: null,
            description: 'Sent if a connection has not authenticated successfully within the configured AUTHENTICATION_TIMEOUT',
            source: 'server'
        }
    }),
    INVALID_MESSAGE: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.CONNECTION,
            action: message_constants_1.AUTH_ACTIONS.INVALID_MESSAGE,
            originalTopic: message_constants_1.TOPIC.EVENT,
            originalAction: message_constants_1.EVENT_ACTIONS.LISTEN
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.CONNECTION, message_constants_1.AUTH_ACTIONS.INVALID_MESSAGE, { t: message_constants_1.TOPIC.EVENT, a: message_constants_1.EVENT_ACTIONS.LISTEN }, ''),
            args: [],
            payload: null,
            description: 'Sent if a connecting socket receives a message with topic other than CONNECTION.',
            source: 'server'
        }
    }),
};
exports.AUTH_MESSAGES = {
    REQUEST: m({
        message: {
            topic: message_constants_1.TOPIC.AUTH,
            action: message_constants_1.AUTH_ACTIONS.REQUEST,
            parsedData: { username: 'ricardo' },
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.AUTH, message_constants_1.AUTH_ACTIONS.REQUEST, '', { username: 'ricardo' }),
            args: [],
            payload: 'authData',
            description: 'Sent to authenticate a client with optional credentials',
            source: 'client'
        }
    }),
    AUTH_SUCCESSFUL: m({
        message: {
            topic: message_constants_1.TOPIC.AUTH,
            action: message_constants_1.AUTH_ACTIONS.AUTH_SUCCESSFUL,
            parsedData: { id: 'foobar' },
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.AUTH, message_constants_1.AUTH_ACTIONS.AUTH_SUCCESSFUL, '', { id: 'foobar' }),
            args: [],
            payload: 'clientData',
            description: 'Sent if authentication was successful',
            source: 'server'
        }
    }),
    AUTH_UNSUCCESSFUL: m({
        message: {
            topic: message_constants_1.TOPIC.AUTH,
            action: message_constants_1.AUTH_ACTIONS.AUTH_UNSUCCESSFUL,
            parsedData: {
                authResponse: 404
            },
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.AUTH, message_constants_1.AUTH_ACTIONS.AUTH_UNSUCCESSFUL, '', { authResponse: 404 }),
            args: [],
            payload: 'clientData',
            description: 'Sent if authentication was unsuccessful',
            source: 'server'
        }
    }),
    TOO_MANY_AUTH_ATTEMPTS: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.AUTH,
            action: message_constants_1.AUTH_ACTIONS.TOO_MANY_AUTH_ATTEMPTS,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.AUTH, message_constants_1.AUTH_ACTIONS.TOO_MANY_AUTH_ATTEMPTS, '', ''),
            args: [],
            payload: null,
            description: 'Sent if the number of unsuccessful authentication attempts exceeds a configured maximum. Followed by a connection close.',
            source: 'server'
        }
    }),
    INVALID_MESSAGE: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.AUTH,
            action: message_constants_1.AUTH_ACTIONS.INVALID_MESSAGE,
            originalTopic: message_constants_1.TOPIC.EVENT,
            originalAction: message_constants_1.EVENT_ACTIONS.LISTEN
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.AUTH, message_constants_1.AUTH_ACTIONS.INVALID_MESSAGE, { t: message_constants_1.TOPIC.EVENT, a: message_constants_1.EVENT_ACTIONS.LISTEN }, ''),
            args: [],
            payload: null,
            description: 'Sent if an authenticating socket receives a message with topic other than AUTH.',
            source: 'server'
        }
    }),
    INVALID_MESSAGE_DATA: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.AUTH,
            action: message_constants_1.AUTH_ACTIONS.INVALID_MESSAGE_DATA,
            originalAction: message_constants_1.AUTH_ACTIONS.REQUEST
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.AUTH, message_constants_1.AUTH_ACTIONS.INVALID_MESSAGE_DATA, { a: message_constants_1.AUTH_ACTIONS.REQUEST }, ''),
            args: [],
            payload: null,
            description: 'Sent if the provided authentication data is invalid.',
            source: 'server'
        }
    }),
    ERROR: null,
};
exports.RECORD_MESSAGES = {
    HEAD: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.HEAD,
            name: 'user/someId',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.HEAD, { n: 'user/someId' }, ''),
            args: ['name'],
            payload: null,
            description: 'Sent to request the current version of a given record',
            source: 'client'
        }
    }),
    HEAD_RESPONSE: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.HEAD_RESPONSE,
            name: 'user/someId',
            version: 12,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.HEAD_RESPONSE, { n: 'user/someId', v: 12 }, ''),
            args: ['name', 'version'],
            payload: null,
            description: 'Sent in response to a \'HEAD\' message with the current version of a record',
            source: 'server'
        }
    }),
    READ: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.READ,
            name: 'user/someId',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.READ, { n: 'user/someId' }, ''),
            args: ['name'],
            payload: null,
            description: 'Sent to request the content of a given record',
            source: 'client'
        }
    }),
    READ_RESPONSE: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.READ_RESPONSE,
            name: 'user/someId',
            parsedData: { firstname: 'Wolfram' },
            version: 1,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.READ_RESPONSE, { n: 'user/someId', v: 1 }, { firstname: 'Wolfram' }),
            args: ['name', 'version'],
            payload: 'recordData',
            description: 'Sent in response to a \'READ\' message with the current version and content of a record',
            source: 'server'
        }
    }),
    UPDATE: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.UPDATE,
            name: 'user/someId',
            version: 1,
            parsedData: { firstname: 'Wolfram' },
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.UPDATE, { n: 'user/someId', v: 1 }, { firstname: 'Wolfram' }),
            args: ['name', 'version'],
            payload: 'recordData',
        }
    }),
    UPDATE_WITH_WRITE_ACK: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.UPDATE_WITH_WRITE_ACK,
            name: 'user/someId',
            version: 1,
            parsedData: { firstname: 'Wolfram' },
            isWriteAck: true,
            correlationId: '8237',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.UPDATE_WITH_WRITE_ACK, { n: 'user/someId', c: '8237', v: 1 }, { firstname: 'Wolfram' }),
            args: ['name', 'version'],
            payload: 'recordData',
        }
    }),
    PATCH: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.PATCH,
            name: 'user/someId',
            path: 'path',
            version: 1,
            parsedData: 'data',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.PATCH, { n: 'user/someId', v: 1, p: 'path' }, '"data"'),
            args: ['name', 'version', 'path'],
            payload: 'patchData',
        }
    }),
    PATCH_WITH_WRITE_ACK: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.PATCH_WITH_WRITE_ACK,
            name: 'user/someId',
            path: 'path',
            version: 1,
            parsedData: 'data',
            isWriteAck: true,
            correlationId: '8237',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.PATCH_WITH_WRITE_ACK, { n: 'user/someId', c: '8237', v: 1, p: 'path' }, '"data"'),
            args: ['name', 'version', 'path'],
            payload: 'patchData',
        }
    }),
    ERASE: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.ERASE,
            name: 'user/someId',
            path: 'path',
            version: 1,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.ERASE, { n: 'user/someId', v: 1, p: 'path' }, ''),
            args: ['name', 'version', 'path'],
            payload: null,
        }
    }),
    ERASE_WITH_WRITE_ACK: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.ERASE_WITH_WRITE_ACK,
            name: 'user/someId',
            path: 'path',
            version: 1,
            isWriteAck: true,
            correlationId: '8237',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.ERASE_WITH_WRITE_ACK, { n: 'user/someId', c: '8237', v: 1, p: 'path' }, ''),
            args: ['name', 'version', 'path'],
            payload: null,
        }
    }),
    CREATEANDUPDATE: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.CREATEANDUPDATE,
            name: 'user/someId',
            version: 1,
            parsedData: { name: 'bob' },
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.CREATEANDUPDATE, { n: 'user/someId', v: 1 }, { name: 'bob' }),
            args: ['name', 'version'],
            payload: 'recordData',
        }
    }),
    CREATEANDUPDATE_WITH_WRITE_ACK: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.CREATEANDUPDATE_WITH_WRITE_ACK,
            name: 'user/someId',
            version: 1,
            parsedData: { name: 'bob' },
            isWriteAck: true,
            correlationId: '8237',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.CREATEANDUPDATE_WITH_WRITE_ACK, { n: 'user/someId', c: '8237', v: 1 }, { name: 'bob' }),
            args: ['name', 'version'],
            payload: 'recordData',
        }
    }),
    CREATEANDPATCH: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.CREATEANDPATCH,
            name: 'user/someId',
            version: 1,
            path: 'path',
            parsedData: 'data',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.CREATEANDPATCH, { n: 'user/someId', v: 1, p: 'path' }, '"data"'),
            args: ['name', 'version', 'path'],
            payload: 'patchData',
        }
    }),
    CREATEANDPATCH_WITH_WRITE_ACK: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.CREATEANDPATCH_WITH_WRITE_ACK,
            name: 'user/someId',
            version: 1,
            path: 'path',
            parsedData: 'data',
            isWriteAck: true,
            correlationId: '8237',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.CREATEANDPATCH_WITH_WRITE_ACK, { n: 'user/someId', c: '8237', v: 1, p: 'path' }, '"data"'),
            args: ['name', 'version', 'path'],
            payload: 'patchData',
        }
    }),
    DELETE: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.DELETE,
            name: 'user/someId',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.DELETE, { n: 'user/someId' }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    DELETE_SUCCESS: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.DELETE_SUCCESS,
            name: 'user/someId',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.DELETE_SUCCESS, { n: 'user/someId' }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    DELETED: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.DELETED,
            name: 'user/someId',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.DELETED, { n: 'user/someId' }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    SUBSCRIBECREATEANDREAD: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.SUBSCRIBECREATEANDREAD,
            name: 'user/someId',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.SUBSCRIBECREATEANDREAD, { n: 'user/someId' }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    SUBSCRIPTION_HAS_PROVIDER: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.SUBSCRIPTION_HAS_PROVIDER,
            name: 'someSubscription',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.SUBSCRIPTION_HAS_PROVIDER, { n: 'someSubscription' }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    SUBSCRIPTION_HAS_NO_PROVIDER: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.SUBSCRIPTION_HAS_NO_PROVIDER,
            name: 'someSubscription',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.SUBSCRIPTION_HAS_NO_PROVIDER, { n: 'someSubscription' }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    WRITE_ACKNOWLEDGEMENT: m({
        message: {
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.WRITE_ACKNOWLEDGEMENT,
            name: 'someSubscription',
            correlationId: '1234',
            isWriteAck: true
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.WRITE_ACKNOWLEDGEMENT, { n: 'someSubscription', c: '1234' }, ''),
            args: ['name', 'correlationId'],
            payload: null,
        }
    }),
    VERSION_EXISTS: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.VERSION_EXISTS,
            name: 'recordName',
            parsedData: {
                x: 'yz'
            },
            version: 1,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.VERSION_EXISTS, { n: 'recordName', v: 1 }, { x: 'yz' }),
            args: ['name', 'version'],
            payload: 'recordData',
        }
    }),
    CACHE_RETRIEVAL_TIMEOUT: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.CACHE_RETRIEVAL_TIMEOUT,
            name: 'recordName',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.CACHE_RETRIEVAL_TIMEOUT, { n: 'recordName' }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    STORAGE_RETRIEVAL_TIMEOUT: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.STORAGE_RETRIEVAL_TIMEOUT,
            name: 'recordName',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.STORAGE_RETRIEVAL_TIMEOUT, { n: 'recordName' }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    RECORD_LOAD_ERROR: null,
    RECORD_CREATE_ERROR: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.RECORD_CREATE_ERROR,
            name: 'recordName'
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.RECORD_CREATE_ERROR, { n: 'recordName' }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    RECORD_UPDATE_ERROR: null,
    RECORD_DELETE_ERROR: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.RECORD_DELETE_ERROR,
            name: 'recordName'
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.RECORD_DELETE_ERROR, { n: 'recordName' }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    RECORD_NOT_FOUND: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.RECORD_NOT_FOUND,
            originalAction: message_constants_1.RECORD_ACTIONS.HEAD,
            name: 'recordName'
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.RECORD_NOT_FOUND, { n: 'recordName', a: message_constants_1.RECORD_ACTIONS.HEAD }, ''),
            args: ['name', 'originalAction'],
            payload: null,
        }
    }),
    INVALID_VERSION: null,
    INVALID_PATCH_ON_HOTPATH: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.INVALID_PATCH_ON_HOTPATH,
            name: 'recordName'
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.INVALID_PATCH_ON_HOTPATH, { n: 'recordName' }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    CREATE: null,
    SUBSCRIBEANDHEAD: null,
    SUBSCRIBEANDREAD: null,
    SUBSCRIBECREATEANDUPDATE: null,
    MESSAGE_PERMISSION_ERROR: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.MESSAGE_PERMISSION_ERROR,
            originalAction: message_constants_1.RECORD_ACTIONS.READ,
            name: 'username',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.MESSAGE_PERMISSION_ERROR, { n: 'username', a: message_constants_1.RECORD_ACTIONS.READ }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    MESSAGE_DENIED: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.MESSAGE_DENIED,
            originalAction: message_constants_1.RECORD_ACTIONS.READ,
            name: 'username',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.MESSAGE_DENIED, { n: 'username', a: message_constants_1.RECORD_ACTIONS.READ }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    INVALID_MESSAGE_DATA: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RECORD,
            action: message_constants_1.RECORD_ACTIONS.INVALID_MESSAGE_DATA,
            originalAction: message_constants_1.RECORD_ACTIONS.CREATEANDUPDATE,
            name: 'recordName',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS.INVALID_MESSAGE_DATA, { n: 'recordName', a: message_constants_1.RECORD_ACTIONS.CREATEANDUPDATE }, ''),
            args: ['originalAction'],
            payload: 'rawData'
        }
    }),
    ERROR: null
};
extendWithSubscriptionMessages(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS, exports.RECORD_MESSAGES);
extendWithListenMessages(message_constants_1.TOPIC.RECORD, message_constants_1.RECORD_ACTIONS, exports.RECORD_MESSAGES);
exports.RPC_MESSAGES = {
    REQUEST_ERROR: m({
        message: {
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.REQUEST_ERROR,
            name: 'addValues',
            correlationId: '1234',
            reason: 'ERROR_MESSAGE',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.REQUEST_ERROR, { n: 'addValues', c: '1234', r: 'ERROR_MESSAGE' }, ''),
            args: ['name', 'correlationId', 'reason'],
            payload: null
        }
    }),
    REQUEST: m({
        message: {
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.REQUEST,
            name: 'addValues',
            correlationId: '1234',
            parsedData: { val1: 1, val2: 2 },
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.REQUEST, { n: 'addValues', c: '1234' }, { val1: 1, val2: 2 }),
            args: ['name', 'correlationId'],
            payload: 'rpcData'
        }
    }),
    ACCEPT: m({
        message: {
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.ACCEPT,
            name: 'addValues',
            correlationId: '1234',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.ACCEPT, { n: 'addValues', c: '1234' }, ''),
            args: ['name', 'correlationId'],
            payload: null
        }
    }),
    REJECT: m({
        message: {
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.REJECT,
            name: 'addValues',
            correlationId: '1234',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.REJECT, { n: 'addValues', c: '1234' }, ''),
            args: ['name', 'correlationId'],
            payload: null
        }
    }),
    RESPONSE: m({
        message: {
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.RESPONSE,
            name: 'addValues',
            correlationId: '1234',
            parsedData: { val1: 1, val2: 2 },
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.RESPONSE, { n: 'addValues', c: '1234' }, { val1: 1, val2: 2 }),
            args: ['name', 'correlationId'],
            payload: 'rpcData'
        }
    }),
    PROVIDE: m({
        message: {
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.PROVIDE,
            name: 'addValues',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.PROVIDE, { n: 'addValues' }, ''),
            args: ['name'],
            payload: null
        }
    }),
    PROVIDE_ACK: m({
        message: {
            isAck: true,
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.PROVIDE,
            name: 'addValues',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.PROVIDE_ACK, { n: 'addValues' }, ''),
            args: ['name'],
            payload: null
        }
    }),
    UNPROVIDE: m({
        message: {
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.UNPROVIDE,
            name: 'addValues',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.UNPROVIDE, { n: 'addValues' }, ''),
            args: ['name'],
            payload: null
        }
    }),
    UNPROVIDE_ACK: m({
        message: {
            isAck: true,
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.UNPROVIDE,
            name: 'addValues',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.UNPROVIDE_ACK, { n: 'addValues' }, ''),
            args: ['name'],
            payload: null
        }
    }),
    MULTIPLE_PROVIDERS: null,
    NOT_PROVIDED: null,
    MULTIPLE_RESPONSE: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.MULTIPLE_RESPONSE,
            name: 'addValues',
            correlationId: '1234',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.MULTIPLE_RESPONSE, { n: 'addValues', c: '1234' }, ''),
            args: ['name', 'correlationId'],
            payload: null
        }
    }),
    RESPONSE_TIMEOUT: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.RESPONSE_TIMEOUT,
            name: 'addValues',
            correlationId: '1234',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.RESPONSE_TIMEOUT, { n: 'addValues', c: '1234' }, ''),
            args: ['name', 'correlationId'],
            payload: null
        }
    }),
    INVALID_RPC_CORRELATION_ID: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.INVALID_RPC_CORRELATION_ID,
            name: 'addValues',
            correlationId: '/=/=/=/',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.INVALID_RPC_CORRELATION_ID, { n: 'addValues', c: '/=/=/=/' }, ''),
            args: ['name', 'correlationId'],
            payload: null
        }
    }),
    MULTIPLE_ACCEPT: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.MULTIPLE_ACCEPT,
            name: 'addValues',
            correlationId: '1234',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.MULTIPLE_ACCEPT, { n: 'addValues', c: '1234' }, ''),
            args: ['name', 'correlationId'],
            payload: null
        }
    }),
    ACCEPT_TIMEOUT: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.ACCEPT_TIMEOUT,
            name: 'addValues',
            correlationId: '1234',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.ACCEPT_TIMEOUT, { n: 'addValues', c: '1234' }, ''),
            args: ['name', 'correlationId'],
            payload: null
        }
    }),
    NO_RPC_PROVIDER: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.NO_RPC_PROVIDER,
            name: 'addValues',
            correlationId: '1234',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.NO_RPC_PROVIDER, { n: 'addValues', c: '1234' }, ''),
            args: ['name', 'correlationId'],
            payload: null
        }
    }),
    MESSAGE_PERMISSION_ERROR: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.MESSAGE_PERMISSION_ERROR,
            originalAction: message_constants_1.RPC_ACTIONS.PROVIDE,
            name: 'username',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.MESSAGE_PERMISSION_ERROR, { n: 'username', a: message_constants_1.RPC_ACTIONS.PROVIDE }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    MESSAGE_DENIED: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.MESSAGE_DENIED,
            originalAction: message_constants_1.RPC_ACTIONS.PROVIDE,
            name: 'username',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.MESSAGE_DENIED, { n: 'username', a: message_constants_1.RPC_ACTIONS.PROVIDE }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    INVALID_MESSAGE_DATA: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.RPC,
            action: message_constants_1.RPC_ACTIONS.INVALID_MESSAGE_DATA,
            originalAction: message_constants_1.RPC_ACTIONS.REQUEST
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.RPC, message_constants_1.RPC_ACTIONS.INVALID_MESSAGE_DATA, { a: message_constants_1.RPC_ACTIONS.REQUEST }, ''),
            args: ['originalAction'],
            payload: 'rawData'
        }
    }),
    ERROR: null
};
exports.EVENT_MESSAGES = {
    EMIT: m({
        message: {
            topic: message_constants_1.TOPIC.EVENT,
            action: message_constants_1.EVENT_ACTIONS.EMIT,
            name: 'someEvent',
            parsedData: 'data',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.EVENT, message_constants_1.EVENT_ACTIONS.EMIT, { n: 'someEvent' }, '"data"'),
            args: ['name'],
            payload: 'eventData',
            description: 'Sent to emit an event',
            source: 'server/client'
        }
    }),
    MESSAGE_PERMISSION_ERROR: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.EVENT,
            action: message_constants_1.EVENT_ACTIONS.MESSAGE_PERMISSION_ERROR,
            originalAction: message_constants_1.EVENT_ACTIONS.SUBSCRIBE,
            name: 'username',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.EVENT, message_constants_1.EVENT_ACTIONS.MESSAGE_PERMISSION_ERROR, { n: 'username', a: message_constants_1.EVENT_ACTIONS.SUBSCRIBE }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    MESSAGE_DENIED: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.EVENT,
            action: message_constants_1.EVENT_ACTIONS.MESSAGE_DENIED,
            originalAction: message_constants_1.EVENT_ACTIONS.SUBSCRIBE,
            name: 'username',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.EVENT, message_constants_1.EVENT_ACTIONS.MESSAGE_DENIED, { n: 'username', a: message_constants_1.EVENT_ACTIONS.SUBSCRIBE }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    INVALID_MESSAGE_DATA: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.EVENT,
            action: message_constants_1.EVENT_ACTIONS.INVALID_MESSAGE_DATA,
            originalAction: message_constants_1.EVENT_ACTIONS.EMIT,
            name: 'eventName'
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.EVENT, message_constants_1.EVENT_ACTIONS.INVALID_MESSAGE_DATA, { a: message_constants_1.EVENT_ACTIONS.EMIT, n: 'eventName' }, ''),
            args: ['originalAction'],
            payload: 'rawData'
        }
    }),
    ERROR: null
};
extendWithSubscriptionMessages(message_constants_1.TOPIC.EVENT, message_constants_1.EVENT_ACTIONS, exports.EVENT_MESSAGES);
extendWithListenMessages(message_constants_1.TOPIC.EVENT, message_constants_1.EVENT_ACTIONS, exports.EVENT_MESSAGES);
exports.PRESENCE_MESSAGES = {
    SUBSCRIBE: m({
        message: {
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.SUBSCRIBE,
            correlationId: '1234',
            names: ['alan', 'john'],
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.SUBSCRIBE, { c: '1234', m: ['alan', 'john'] }, ''),
            args: ['correlationId', 'names'],
            payload: null
        }
    }),
    SUBSCRIBE_ACK: m({
        message: {
            isAck: true,
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.SUBSCRIBE,
            correlationId: '1234'
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.SUBSCRIBE_ACK, { c: '1234' }, ''),
            args: ['correlationId'],
            payload: null
        }
    }),
    SUBSCRIBE_ALL: m({
        message: {
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.SUBSCRIBE_ALL,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.SUBSCRIBE_ALL, '', ''),
            args: [],
            payload: null
        }
    }),
    SUBSCRIBE_ALL_ACK: m({
        message: {
            isAck: true,
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.SUBSCRIBE_ALL,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.SUBSCRIBE_ALL_ACK, '', ''),
            args: [],
            payload: null
        }
    }),
    UNSUBSCRIBE: m({
        message: {
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.UNSUBSCRIBE,
            correlationId: '1234',
            names: ['alan', 'john'],
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.UNSUBSCRIBE, { c: '1234', m: ['alan', 'john'] }, ''),
            args: ['correlationId', 'names'],
            payload: null
        }
    }),
    UNSUBSCRIBE_ACK: m({
        message: {
            isAck: true,
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.UNSUBSCRIBE,
            correlationId: '1234',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.UNSUBSCRIBE_ACK, { c: '1234' }, ''),
            args: ['correlationId'],
            payload: null
        }
    }),
    UNSUBSCRIBE_ALL: m({
        message: {
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.UNSUBSCRIBE_ALL,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.UNSUBSCRIBE_ALL, '', ''),
            args: [],
            payload: null
        }
    }),
    UNSUBSCRIBE_ALL_ACK: m({
        message: {
            isAck: true,
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.UNSUBSCRIBE_ALL,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.UNSUBSCRIBE_ALL_ACK, '', ''),
            args: [],
            payload: null
        }
    }),
    MULTIPLE_SUBSCRIPTIONS: null,
    NOT_SUBSCRIBED: null,
    QUERY_ALL: m({
        message: {
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.QUERY_ALL,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.QUERY_ALL, '', ''),
            args: [],
            payload: null
        }
    }),
    QUERY_ALL_RESPONSE: m({
        message: {
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.QUERY_ALL_RESPONSE,
            names: ['alan', 'sarah'],
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.QUERY_ALL_RESPONSE, { m: ['alan', 'sarah'] }, ''),
            args: ['names'],
            payload: null
        }
    }),
    QUERY: m({
        message: {
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.QUERY,
            correlationId: '1234',
            names: ['alan'],
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.QUERY, { c: '1234', m: ['alan'] }, ''),
            args: ['correlationId', 'names'],
            payload: null
        }
    }),
    QUERY_RESPONSE: m({
        message: {
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.QUERY_RESPONSE,
            correlationId: '1234',
            parsedData: { alan: true },
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.QUERY_RESPONSE, { c: '1234' }, { alan: true }),
            args: ['correlationId'],
            payload: 'userMap'
        }
    }),
    PRESENCE_JOIN: m({
        message: {
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.PRESENCE_JOIN,
            name: 'username',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.PRESENCE_JOIN, { n: 'username' }, ''),
            args: ['name'],
            payload: null
        }
    }),
    PRESENCE_JOIN_ALL: m({
        message: {
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.PRESENCE_JOIN_ALL,
            name: 'username',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.PRESENCE_JOIN_ALL, { n: 'username' }, ''),
            args: ['name'],
            payload: null
        }
    }),
    PRESENCE_LEAVE: m({
        message: {
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.PRESENCE_LEAVE,
            name: 'username',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.PRESENCE_LEAVE, { n: 'username' }, ''),
            args: ['name'],
            payload: null
        }
    }),
    PRESENCE_LEAVE_ALL: m({
        message: {
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.PRESENCE_LEAVE_ALL,
            name: 'username',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.PRESENCE_LEAVE_ALL, { n: 'username' }, ''),
            args: ['name'],
            payload: null
        }
    }),
    INVALID_PRESENCE_USERS: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.INVALID_PRESENCE_USERS,
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.INVALID_PRESENCE_USERS, '', ''),
            args: [],
            payload: null
        }
    }),
    MESSAGE_PERMISSION_ERROR: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.MESSAGE_PERMISSION_ERROR,
            originalAction: message_constants_1.PRESENCE_ACTIONS.QUERY,
            name: 'username',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.MESSAGE_PERMISSION_ERROR, { n: 'username', a: message_constants_1.PRESENCE_ACTIONS.QUERY }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    MESSAGE_DENIED: m({
        message: {
            isError: true,
            topic: message_constants_1.TOPIC.PRESENCE,
            action: message_constants_1.PRESENCE_ACTIONS.MESSAGE_DENIED,
            originalAction: message_constants_1.PRESENCE_ACTIONS.QUERY,
            name: 'username',
        },
        urp: {
            value: binMsg(message_constants_1.TOPIC.PRESENCE, message_constants_1.PRESENCE_ACTIONS.MESSAGE_DENIED, { n: 'username', a: message_constants_1.PRESENCE_ACTIONS.QUERY }, ''),
            args: ['name'],
            payload: null,
        }
    }),
    ERROR: null
};
exports.MESSAGES = {
    [message_constants_1.TOPIC.PARSER]: exports.PARSER_MESSAGES,
    [message_constants_1.TOPIC.RECORD]: exports.RECORD_MESSAGES,
    [message_constants_1.TOPIC.RPC]: exports.RPC_MESSAGES,
    [message_constants_1.TOPIC.EVENT]: exports.EVENT_MESSAGES,
    [message_constants_1.TOPIC.AUTH]: exports.AUTH_MESSAGES,
    [message_constants_1.TOPIC.CONNECTION]: exports.CONNECTION_MESSAGES,
    [message_constants_1.TOPIC.PRESENCE]: exports.PRESENCE_MESSAGES,
};
//# sourceMappingURL=messages.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("./constants");
const WA = constants_1.MESSAGE_PART_SEPERATOR + JSON.stringify({ writeSuccess: true });
const NWA = constants_1.MESSAGE_PART_SEPERATOR + '{}';
const A = 'A' + constants_1.MESSAGE_PART_SEPERATOR;
const genericError = (msg, event, eventMessage) => `${constants_1.TOPIC_BYTE_TO_TEXT[msg.topic]}${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}${event}${constants_1.MESSAGE_PART_SEPERATOR}${eventMessage}${constants_1.MESSAGE_SEPERATOR}`;
const invalidMessageData = (msg, event) => `${constants_1.TOPIC_BYTE_TO_TEXT[msg.topic]}${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}INVALID_MESSAGE_DATA${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${constants_1.MESSAGE_SEPERATOR}`;
const messagePermissionError = (msg, event) => `${constants_1.TOPIC_BYTE_TO_TEXT[msg.topic]}${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}MESSAGE_PERMISSION_ERROR${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.ACTIONS_BYTE_TO_TEXT[msg.topic][msg.action] ? constants_1.MESSAGE_PART_SEPERATOR + constants_1.ACTIONS_BYTE_TO_TEXT[msg.topic][msg.action] : ''}${msg.correlationId ? constants_1.MESSAGE_PART_SEPERATOR + msg.correlationId : ''}${constants_1.MESSAGE_SEPERATOR}`;
const messageDenied = (msg, event) => `${constants_1.TOPIC_BYTE_TO_TEXT[msg.topic]}${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}MESSAGE_DENIED${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.ACTIONS_BYTE_TO_TEXT[msg.topic][msg.action] ? constants_1.MESSAGE_PART_SEPERATOR + constants_1.ACTIONS_BYTE_TO_TEXT[msg.topic][msg.action] : ''}${msg.correlationId ? constants_1.MESSAGE_PART_SEPERATOR + msg.correlationId : ''}${constants_1.MESSAGE_SEPERATOR}`;
const notSubscribed = (msg, event) => `${constants_1.TOPIC_BYTE_TO_TEXT[msg.topic]}${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}NOT_SUBSCRIBED${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`;
const invalidAuth = msg => `A${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}INVALID_AUTH_DATA${constants_1.MESSAGE_PART_SEPERATOR}${msg.data ? msg.data : 'U'}${constants_1.MESSAGE_SEPERATOR}`;
const recordUpdate = msg => `R${constants_1.MESSAGE_PART_SEPERATOR}U${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.version}${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${msg.isWriteAck ? WA : ''}${constants_1.MESSAGE_SEPERATOR}`;
const recordPatch = msg => `R${constants_1.MESSAGE_PART_SEPERATOR}P${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.version}${constants_1.MESSAGE_PART_SEPERATOR}${msg.path}${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${msg.isWriteAck ? WA : ''}${constants_1.MESSAGE_SEPERATOR}`;
const subscriptionForPatternFound = msg => `${constants_1.TOPIC_BYTE_TO_TEXT[msg.topic]}${constants_1.MESSAGE_PART_SEPERATOR}SP${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.subscription}${constants_1.MESSAGE_SEPERATOR}`;
const subscriptionForPatternRemoved = msg => `${constants_1.TOPIC_BYTE_TO_TEXT[msg.topic]}${constants_1.MESSAGE_PART_SEPERATOR}SR${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.subscription}${constants_1.MESSAGE_SEPERATOR}`;
const listen = (msg, event, isAck) => `${constants_1.TOPIC_BYTE_TO_TEXT[msg.topic]}${constants_1.MESSAGE_PART_SEPERATOR}${isAck ? A : ''}L${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`;
const unlisten = (msg, event, isAck) => `${constants_1.TOPIC_BYTE_TO_TEXT[msg.topic]}${constants_1.MESSAGE_PART_SEPERATOR}${isAck ? A : ''}UL${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`;
const listenAccept = msg => `${constants_1.TOPIC_BYTE_TO_TEXT[msg.topic]}${constants_1.MESSAGE_PART_SEPERATOR}LA${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.subscription}${constants_1.MESSAGE_SEPERATOR}`;
const listenReject = msg => `${constants_1.TOPIC_BYTE_TO_TEXT[msg.topic]}${constants_1.MESSAGE_PART_SEPERATOR}LR${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.subscription}${constants_1.MESSAGE_SEPERATOR}`;
const multipleSubscriptions = msg => `${constants_1.TOPIC_BYTE_TO_TEXT[msg.topic]}${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}MULTIPLE_SUBSCRIPTIONS${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`;
const BUILDERS = {
    [constants_1.TOPIC.CONNECTION.BYTE]: {
        [constants_1.CONNECTION_ACTIONS.ERROR.BYTE]: genericError,
        [constants_1.CONNECTION_ACTIONS.CHALLENGE.BYTE]: msg => `C${constants_1.MESSAGE_PART_SEPERATOR}CH${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.CONNECTION_ACTIONS.CHALLENGE_RESPONSE.BYTE]: msg => `C${constants_1.MESSAGE_PART_SEPERATOR}CHR${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.CONNECTION_ACTIONS.ACCEPT.BYTE]: msg => `C${constants_1.MESSAGE_PART_SEPERATOR}A${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.CONNECTION_ACTIONS.REJECTION.BYTE]: msg => `C${constants_1.MESSAGE_PART_SEPERATOR}REJ${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.CONNECTION_ACTIONS.REDIRECT.BYTE]: msg => `C${constants_1.MESSAGE_PART_SEPERATOR}RED${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.CONNECTION_ACTIONS.PING.BYTE]: msg => `C${constants_1.MESSAGE_PART_SEPERATOR}PI${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.CONNECTION_ACTIONS.PONG.BYTE]: msg => `C${constants_1.MESSAGE_PART_SEPERATOR}PO${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.CONNECTION_ACTIONS.CONNECTION_AUTHENTICATION_TIMEOUT.BYTE]: msg => `C${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}CONNECTION_AUTHENTICATION_TIMEOUT${constants_1.MESSAGE_SEPERATOR}`,
    },
    [constants_1.TOPIC.AUTH.BYTE]: {
        [constants_1.AUTH_ACTIONS.ERROR.BYTE]: genericError,
        [constants_1.AUTH_ACTIONS.REQUEST.BYTE]: msg => `A${constants_1.MESSAGE_PART_SEPERATOR}REQ${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.AUTH_ACTIONS.AUTH_SUCCESSFUL.BYTE]: msg => `A${constants_1.MESSAGE_PART_SEPERATOR}A${msg.data ? constants_1.MESSAGE_PART_SEPERATOR + msg.data : ''}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.AUTH_ACTIONS.AUTH_UNSUCCESSFUL.BYTE]: invalidAuth,
        [constants_1.AUTH_ACTIONS.INVALID_MESSAGE_DATA.BYTE]: invalidAuth,
        [constants_1.AUTH_ACTIONS.TOO_MANY_AUTH_ATTEMPTS.BYTE]: msg => `A${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}TOO_MANY_AUTH_ATTEMPTS${constants_1.MESSAGE_SEPERATOR}`,
    },
    [constants_1.TOPIC.EVENT.BYTE]: {
        [constants_1.EVENT_ACTIONS.ERROR.BYTE]: genericError,
        [constants_1.EVENT_ACTIONS.SUBSCRIBE.BYTE]: (msg, event, isAck) => `E${constants_1.MESSAGE_PART_SEPERATOR}${isAck ? A : ''}S${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.EVENT_ACTIONS.UNSUBSCRIBE.BYTE]: (msg, event, isAck) => `E${constants_1.MESSAGE_PART_SEPERATOR}${isAck ? A : ''}US${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.EVENT_ACTIONS.EMIT.BYTE]: msg => `E${constants_1.MESSAGE_PART_SEPERATOR}EVT${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.data ? msg.data : 'U'}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.EVENT_ACTIONS.LISTEN.BYTE]: listen,
        [constants_1.EVENT_ACTIONS.UNLISTEN.BYTE]: unlisten,
        [constants_1.EVENT_ACTIONS.LISTEN_ACCEPT.BYTE]: listenAccept,
        [constants_1.EVENT_ACTIONS.LISTEN_REJECT.BYTE]: listenReject,
        [constants_1.EVENT_ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND.BYTE]: subscriptionForPatternFound,
        [constants_1.EVENT_ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED.BYTE]: subscriptionForPatternRemoved,
        [constants_1.EVENT_ACTIONS.INVALID_MESSAGE_DATA.BYTE]: invalidMessageData,
        [constants_1.EVENT_ACTIONS.MESSAGE_DENIED.BYTE]: messageDenied,
        [constants_1.EVENT_ACTIONS.MESSAGE_PERMISSION_ERROR.BYTE]: messagePermissionError,
        [constants_1.EVENT_ACTIONS.NOT_SUBSCRIBED.BYTE]: notSubscribed,
        [constants_1.EVENT_ACTIONS.MULTIPLE_SUBSCRIPTIONS.BYTE]: multipleSubscriptions,
    },
    [constants_1.TOPIC.RECORD.BYTE]: {
        [constants_1.RECORD_ACTIONS.ERROR.BYTE]: genericError,
        [constants_1.RECORD_ACTIONS.HEAD.BYTE]: (msg, event) => `R${constants_1.MESSAGE_PART_SEPERATOR}HD${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.HEAD_RESPONSE.BYTE]: (msg, event) => `R${constants_1.MESSAGE_PART_SEPERATOR}HD${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.version}${constants_1.MESSAGE_PART_SEPERATOR}null${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.READ.BYTE]: (msg, event) => `R${constants_1.MESSAGE_PART_SEPERATOR}R${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.READ_RESPONSE.BYTE]: (msg, event) => `R${constants_1.MESSAGE_PART_SEPERATOR}R${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.version}${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.UPDATE.BYTE]: recordUpdate,
        [constants_1.RECORD_ACTIONS.UPDATE_WITH_WRITE_ACK.BYTE]: recordUpdate,
        [constants_1.RECORD_ACTIONS.PATCH.BYTE]: recordPatch,
        [constants_1.RECORD_ACTIONS.PATCH_WITH_WRITE_ACK.BYTE]: recordPatch,
        [constants_1.RECORD_ACTIONS.ERASE.BYTE]: (msg, event) => `R${constants_1.MESSAGE_PART_SEPERATOR}P${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.version}${constants_1.MESSAGE_PART_SEPERATOR}${msg.path}${constants_1.MESSAGE_PART_SEPERATOR}U${msg.isWriteAck ? WA : ''}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.ERASE_WITH_WRITE_ACK.BYTE]: (msg, event) => `R${constants_1.MESSAGE_PART_SEPERATOR}P${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.version}${constants_1.MESSAGE_PART_SEPERATOR}${msg.path}${constants_1.MESSAGE_PART_SEPERATOR}U${msg.isWriteAck ? WA : ''}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.CREATEANDUPDATE.BYTE]: (msg, event) => `R${constants_1.MESSAGE_PART_SEPERATOR}CU${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.version}${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${msg.isWriteAck ? WA : NWA}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.CREATEANDUPDATE_WITH_WRITE_ACK.BYTE]: (msg, event) => `R${constants_1.MESSAGE_PART_SEPERATOR}CU${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.version}${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${msg.isWriteAck ? WA : NWA}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.CREATEANDPATCH.BYTE]: (msg, event) => `R${constants_1.MESSAGE_PART_SEPERATOR}CU${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.version}${constants_1.MESSAGE_PART_SEPERATOR}${msg.path}${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${msg.isWriteAck ? WA : NWA}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.CREATEANDPATCH_WITH_WRITE_ACK.BYTE]: (msg, event) => `R${constants_1.MESSAGE_PART_SEPERATOR}CU${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.version}${constants_1.MESSAGE_PART_SEPERATOR}${msg.path}${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${msg.isWriteAck ? WA : NWA}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.DELETE.BYTE]: (msg, event, isAck) => `R${constants_1.MESSAGE_PART_SEPERATOR}${isAck ? A : ''}D${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.DELETED.BYTE]: (msg, event) => `R${constants_1.MESSAGE_PART_SEPERATOR}A${constants_1.MESSAGE_PART_SEPERATOR}D${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.SUBSCRIBECREATEANDREAD.BYTE]: (msg, event) => `R${constants_1.MESSAGE_PART_SEPERATOR}CR${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.SUBSCRIBE.BYTE]: (msg, event, isAck) => `R${constants_1.MESSAGE_PART_SEPERATOR}${isAck ? A : ''}S${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.UNSUBSCRIBE.BYTE]: (msg, event, isAck) => `R${constants_1.MESSAGE_PART_SEPERATOR}${isAck ? A : ''}US${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.WRITE_ACKNOWLEDGEMENT.BYTE]: (msg, event, isAck) => `R${constants_1.MESSAGE_PART_SEPERATOR}WA${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${JSON.stringify(msg.parsedData[0])}${constants_1.MESSAGE_PART_SEPERATOR}${exports.typed(msg.parsedData[1])}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.LISTEN.BYTE]: listen,
        [constants_1.RECORD_ACTIONS.UNLISTEN.BYTE]: unlisten,
        [constants_1.RECORD_ACTIONS.LISTEN_ACCEPT.BYTE]: listenAccept,
        [constants_1.RECORD_ACTIONS.LISTEN_REJECT.BYTE]: listenReject,
        [constants_1.RECORD_ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND.BYTE]: subscriptionForPatternFound,
        [constants_1.RECORD_ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED.BYTE]: subscriptionForPatternRemoved,
        [constants_1.RECORD_ACTIONS.SUBSCRIPTION_HAS_PROVIDER.BYTE]: msg => `R${constants_1.MESSAGE_PART_SEPERATOR}SH${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}T${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.SUBSCRIPTION_HAS_NO_PROVIDER.BYTE]: msg => `R${constants_1.MESSAGE_PART_SEPERATOR}SH${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}F${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.STORAGE_RETRIEVAL_TIMEOUT.BYTE]: msg => `R${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}STORAGE_RETRIEVAL_TIMEOUT${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.CACHE_RETRIEVAL_TIMEOUT.BYTE]: msg => `R${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}CACHE_RETRIEVAL_TIMEOUT${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.VERSION_EXISTS.BYTE]: msg => `R${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}VERSION_EXISTS${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.version}${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${msg.isWriteAck ? WA : ''}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.RECORD_NOT_FOUND.BYTE]: msg => `R${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}${constants_1.ACTIONS_BYTE_TO_TEXT[msg.topic][msg.action]}${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}RECORD_NOT_FOUND${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.INVALID_MESSAGE_DATA.BYTE]: invalidMessageData,
        [constants_1.RECORD_ACTIONS.MESSAGE_DENIED.BYTE]: messageDenied,
        [constants_1.RECORD_ACTIONS.MESSAGE_PERMISSION_ERROR.BYTE]: messagePermissionError,
        [constants_1.RECORD_ACTIONS.NOT_SUBSCRIBED.BYTE]: notSubscribed,
        [constants_1.RECORD_ACTIONS.MULTIPLE_SUBSCRIPTIONS.BYTE]: multipleSubscriptions,
        [constants_1.RECORD_ACTIONS.HAS.BYTE]: msg => `R${constants_1.MESSAGE_PART_SEPERATOR}H${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RECORD_ACTIONS.HAS_RESPONSE.BYTE]: msg => `R${constants_1.MESSAGE_PART_SEPERATOR}H${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.parsedData ? 'T' : 'F'}${constants_1.MESSAGE_SEPERATOR}`,
    },
    [constants_1.TOPIC.RPC.BYTE]: {
        [constants_1.RPC_ACTIONS.ERROR.BYTE]: genericError,
        [constants_1.RPC_ACTIONS.PROVIDE.BYTE]: (msg, event, isAck) => `P${constants_1.MESSAGE_PART_SEPERATOR}${isAck ? A : ''}S${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RPC_ACTIONS.UNPROVIDE.BYTE]: (msg, event, isAck) => `P${constants_1.MESSAGE_PART_SEPERATOR}${isAck ? A : ''}US${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RPC_ACTIONS.REQUEST.BYTE]: msg => `P${constants_1.MESSAGE_PART_SEPERATOR}REQ${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId}${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RPC_ACTIONS.RESPONSE.BYTE]: msg => `P${constants_1.MESSAGE_PART_SEPERATOR}RES${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId}${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RPC_ACTIONS.REQUEST_ERROR.BYTE]: msg => `P${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RPC_ACTIONS.REJECT.BYTE]: msg => `P${constants_1.MESSAGE_PART_SEPERATOR}REJ${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RPC_ACTIONS.ACCEPT.BYTE]: msg => `P${constants_1.MESSAGE_PART_SEPERATOR}A${constants_1.MESSAGE_PART_SEPERATOR}REQ${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RPC_ACTIONS.NO_RPC_PROVIDER.BYTE]: msg => `P${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}NO_RPC_PROVIDER${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RPC_ACTIONS.INVALID_RPC_CORRELATION_ID.BYTE]: msg => `P${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}INVALID_RPC_CORRELATION_ID${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RPC_ACTIONS.RESPONSE_TIMEOUT.BYTE]: msg => `P${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}RESPONSE_TIMEOUT${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RPC_ACTIONS.MULTIPLE_RESPONSE.BYTE]: msg => `P${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}MULTIPLE_RESPONSE${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RPC_ACTIONS.MULTIPLE_ACCEPT.BYTE]: msg => `P${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}MULTIPLE_ACCEPT${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RPC_ACTIONS.ACCEPT_TIMEOUT.BYTE]: msg => `P${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}ACCEPT_TIMEOUT${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.RPC_ACTIONS.INVALID_MESSAGE_DATA.BYTE]: invalidMessageData,
        [constants_1.RPC_ACTIONS.MESSAGE_DENIED.BYTE]: messageDenied,
        [constants_1.RPC_ACTIONS.MESSAGE_PERMISSION_ERROR.BYTE]: messagePermissionError,
        [constants_1.RPC_ACTIONS.NOT_PROVIDED.BYTE]: notSubscribed,
        [constants_1.RPC_ACTIONS.MULTIPLE_PROVIDERS.BYTE]: multipleSubscriptions,
    },
    [constants_1.TOPIC.PRESENCE.BYTE]: {
        [constants_1.PRESENCE_ACTIONS.ERROR.BYTE]: genericError,
        [constants_1.PRESENCE_ACTIONS.SUBSCRIBE.BYTE]: (msg, event, isAck) => `U${constants_1.MESSAGE_PART_SEPERATOR}${isAck ? A : ''}S${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId ? msg.correlationId + constants_1.MESSAGE_PART_SEPERATOR : ''}${msg.name ? msg.name : msg.data}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.PRESENCE_ACTIONS.UNSUBSCRIBE.BYTE]: (msg, event, isAck) => `U${constants_1.MESSAGE_PART_SEPERATOR}${isAck ? A : ''}US${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId ? msg.correlationId + constants_1.MESSAGE_PART_SEPERATOR : ''}${msg.name ? msg.name : msg.data}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.PRESENCE_ACTIONS.QUERY.BYTE]: msg => `U${constants_1.MESSAGE_PART_SEPERATOR}Q${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId}${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.PRESENCE_ACTIONS.QUERY_RESPONSE.BYTE]: msg => `U${constants_1.MESSAGE_PART_SEPERATOR}Q${constants_1.MESSAGE_PART_SEPERATOR}${msg.correlationId}${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.PRESENCE_ACTIONS.QUERY_ALL.BYTE]: msg => `U${constants_1.MESSAGE_PART_SEPERATOR}Q${constants_1.MESSAGE_PART_SEPERATOR}Q${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.PRESENCE_ACTIONS.QUERY_ALL_RESPONSE.BYTE]: msg => `U${constants_1.MESSAGE_PART_SEPERATOR}Q${msg.parsedData.length > 0 ? constants_1.MESSAGE_PART_SEPERATOR + msg.parsedData.join(constants_1.MESSAGE_PART_SEPERATOR) : ''}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.PRESENCE_ACTIONS.PRESENCE_JOIN.BYTE]: msg => `U${constants_1.MESSAGE_PART_SEPERATOR}PNJ${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.PRESENCE_ACTIONS.PRESENCE_LEAVE.BYTE]: msg => `U${constants_1.MESSAGE_PART_SEPERATOR}PNL${constants_1.MESSAGE_PART_SEPERATOR}${msg.name}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.PRESENCE_ACTIONS.INVALID_PRESENCE_USERS.BYTE]: msg => `U${constants_1.MESSAGE_PART_SEPERATOR}E${constants_1.MESSAGE_PART_SEPERATOR}INVALID_PRESENCE_USERS${constants_1.MESSAGE_PART_SEPERATOR}${msg.data}${constants_1.MESSAGE_SEPERATOR}`,
        [constants_1.PRESENCE_ACTIONS.INVALID_MESSAGE_DATA.BYTE]: invalidMessageData,
        [constants_1.PRESENCE_ACTIONS.MESSAGE_DENIED.BYTE]: messageDenied,
        [constants_1.PRESENCE_ACTIONS.MESSAGE_PERMISSION_ERROR.BYTE]: messagePermissionError,
        [constants_1.PRESENCE_ACTIONS.NOT_SUBSCRIBED.BYTE]: notSubscribed,
        [constants_1.PRESENCE_ACTIONS.MULTIPLE_SUBSCRIPTIONS.BYTE]: multipleSubscriptions,
    },
};
/**
 * Creates a deepstream message string, based on the
 * provided parameters
 */
exports.getMessage = (message, isAck) => {
    if (!BUILDERS[message.topic] || !BUILDERS[message.topic][message.action]) {
        console.log(message, isAck);
    }
    const builder = BUILDERS[message.topic][message.action];
    if (!builder) {
        console.error('missing builder for', message);
        return '';
    }
    else {
        if (message.topic === 6 && !message.parsedData && !message.data &&
            (message.action === constants_1.RPC_ACTIONS.RESPONSE.BYTE || message.action === constants_1.RPC_ACTIONS.REQUEST.BYTE)) {
            message.data = 'U';
        }
        else if (message.parsedData && message.data === undefined) {
            if (constants_1.ACTIONS_BYTE_TO_PAYLOAD[message.topic][message.action] === constants_1.PAYLOAD_ENCODING.JSON) {
                message.data = JSON.stringify(message.parsedData);
            }
            else {
                message.data = exports.typed(message.parsedData);
            }
        }
        return builder(message, null, isAck);
    }
};
/**
 * Creates a deepstream error message string based on the provided
 * arguments
 */
exports.getErrorMessage = function (message, errorAction, errorMessage) {
    if (!BUILDERS[message.topic] || !BUILDERS[message.topic][errorAction]) {
        // console.trace(message, errorAction, errorMessage)
    }
    const builder = BUILDERS[message.topic][errorAction];
    if (message.parsedData && message.data === undefined) {
        if (message.dataEncoding === constants_1.PAYLOAD_ENCODING.JSON) {
            message.data = JSON.stringify(message.parsedData);
        }
        else if (message.dataEncoding === constants_1.PAYLOAD_ENCODING.DEEPSTREAM) {
            message.data = exports.typed(message.parsedData);
        }
    }
    return builder(message, errorAction, errorMessage);
};
/**
 * Converts a serializable value into its string-representation and adds
 * a flag that provides instructions on how to deserialize it.
 *
 * Please see messageParser.convertTyped for the counterpart of this method
 */
exports.typed = function (value) {
    const type = typeof value;
    if (type === 'string') {
        return constants_1.DEEPSTREAM_TYPES.STRING + value;
    }
    if (value === null) {
        return constants_1.DEEPSTREAM_TYPES.NULL;
    }
    if (type === 'object') {
        return constants_1.DEEPSTREAM_TYPES.OBJECT + JSON.stringify(value);
    }
    if (type === 'number') {
        return constants_1.DEEPSTREAM_TYPES.NUMBER + value.toString();
    }
    if (value === true) {
        return constants_1.DEEPSTREAM_TYPES.TRUE;
    }
    if (value === false) {
        return constants_1.DEEPSTREAM_TYPES.FALSE;
    }
    if (value === undefined) {
        return constants_1.DEEPSTREAM_TYPES.UNDEFINED;
    }
    throw new Error(`Can't serialize type ${value}`);
};
//# sourceMappingURL=message-builder.js.map
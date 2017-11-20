"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const message_constants_1 = require("./message-constants");
function isWriteAck(action) {
    return action === message_constants_1.RECORD_ACTIONS.CREATEANDPATCH_WITH_WRITE_ACK
        || action === message_constants_1.RECORD_ACTIONS.CREATEANDUPDATE_WITH_WRITE_ACK
        || action === message_constants_1.RECORD_ACTIONS.PATCH_WITH_WRITE_ACK
        || action === message_constants_1.RECORD_ACTIONS.UPDATE_WITH_WRITE_ACK
        || action === message_constants_1.RECORD_ACTIONS.ERASE_WITH_WRITE_ACK
        || action === message_constants_1.RECORD_ACTIONS.WRITE_ACKNOWLEDGEMENT;
}
exports.isWriteAck = isWriteAck;
exports.ACTION_TO_WRITE_ACK = {
    [message_constants_1.RECORD_ACTIONS.CREATEANDPATCH]: message_constants_1.RECORD_ACTIONS.CREATEANDPATCH_WITH_WRITE_ACK,
    [message_constants_1.RECORD_ACTIONS.CREATEANDUPDATE]: message_constants_1.RECORD_ACTIONS.CREATEANDUPDATE_WITH_WRITE_ACK,
    [message_constants_1.RECORD_ACTIONS.PATCH]: message_constants_1.RECORD_ACTIONS.PATCH_WITH_WRITE_ACK,
    [message_constants_1.RECORD_ACTIONS.UPDATE]: message_constants_1.RECORD_ACTIONS.UPDATE_WITH_WRITE_ACK,
    [message_constants_1.RECORD_ACTIONS.ERASE]: message_constants_1.RECORD_ACTIONS.ERASE_WITH_WRITE_ACK,
};
/**
 * Like reverseMap but the values will be cast using Number(k)
 */
function reverseMapNumeric(map) {
    const reversedMap = {};
    for (const key in map) {
        reversedMap[map[key]] = Number(key);
    }
    return reversedMap;
}
exports.reverseMapNumeric = reverseMapNumeric;
exports.WRITE_ACK_TO_ACTION = reverseMapNumeric(exports.ACTION_TO_WRITE_ACK);
//# sourceMappingURL=utils.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../../src/constants");
const constants_2 = require("../src/constants");
const messages_1 = require("../src/messages");
describe('protocol', () => {
    for (const topic in constants_1.ACTIONS) {
        for (const action in constants_1.ACTIONS[topic]) {
            if (isNaN(Number(action))) {
                it(`contains message for ${constants_1.TOPIC[topic]} with action ${action} in protocol`, () => {
                    expect(messages_1.MESSAGES[topic][action]).not.toBe(undefined);
                });
            }
            else {
                it(`contains topic ${constants_1.TOPIC[topic]} with action ${constants_1.ACTIONS[topic][action]} in protocol`, () => {
                    expect(constants_2.ACTIONS_BYTE_TO_KEY[topic][action]).not.toBe(undefined);
                });
            }
        }
    }
});
//# sourceMappingURL=message-constantsSpec.js.map
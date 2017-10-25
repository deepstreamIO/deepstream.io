"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../../src/constants");
const message_builder_1 = require("../src/message-builder");
const messages_1 = require("../src/messages");
describe('message builder', () => {
    for (const topic in messages_1.MESSAGES) {
        for (const authAction in messages_1.MESSAGES[topic]) {
            if (!messages_1.MESSAGES[topic][authAction] || Object.keys(messages_1.MESSAGES[topic][authAction]).length === 0) {
                // it (`builds ${TOPIC[topic]} messages ${authAction} correctly`, () => {
                //   pending('Missing message')
                // })
            }
            else if (messages_1.MESSAGES[topic][authAction].text.build === true) {
                it(`builds ${constants_1.TOPIC[topic]} messages ${authAction} correctly`, () => {
                    expect(message_builder_1.getMessage(messages_1.MESSAGES[topic][authAction].message, authAction.indexOf('_ACK') > -1)).toEqual(messages_1.MESSAGES[topic][authAction].text.value);
                });
            }
        }
    }
});
//# sourceMappingURL=message-builderSpec.js.map
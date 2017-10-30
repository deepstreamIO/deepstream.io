"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../../src/constants");
const message_parser_1 = require("../src/message-parser");
const messages_1 = require("../src/messages");
describe('message parser', () => {
    for (const topic in messages_1.MESSAGES) {
        for (const authAction in messages_1.MESSAGES[topic]) {
            if (!messages_1.MESSAGES[topic][authAction] || messages_1.MESSAGES[topic][authAction].text === undefined) {
                // it (`parses ${TOPIC[topic]} messages ${authAction} correctly`, () => {
                //  pending('Missing message')
                // })
            }
            else if (messages_1.MESSAGES[topic][authAction].text.parse === true) {
                it(`parses ${constants_1.TOPIC[topic]} messages ${authAction} correctly`, () => {
                    expect(message_parser_1.parse(messages_1.MESSAGES[topic][authAction].text.value)).toEqual([messages_1.MESSAGES[topic][authAction].message]);
                });
            }
        }
    }
});
//# sourceMappingURL=message-parserSpec.js.map
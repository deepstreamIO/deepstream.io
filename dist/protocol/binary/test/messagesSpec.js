"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const message_constants_1 = require("../src/message-constants");
const message_validator_1 = require("../src/message-validator");
const messages_1 = require("./messages");
describe('protocol', () => {
    for (const topic in message_constants_1.ACTIONS) {
        for (const action in message_constants_1.ACTIONS[topic]) {
            if (isNaN(Number(action))) {
                it(`contains message for ${message_constants_1.TOPIC[topic]} with action ${action} in protocol`, () => {
                    expect(messages_1.MESSAGES[topic][action]).toBeDefined();
                });
            }
        }
    }
});
xdescribe('message params', () => {
    for (const topicStr in messages_1.MESSAGES) {
        const topic = Number(topicStr);
        for (const actionStr in messages_1.MESSAGES[topic]) {
            const spec = messages_1.MESSAGES[topic][actionStr];
            const action = message_constants_1.ACTIONS[topic][actionStr];
            it(`spec for topic ${message_constants_1.TOPIC[topic]} with action ${actionStr} is valid`, () => {
                if (spec && !spec.message.parseError) {
                    // expect(validate(spec.message)).not.toBeDefined()
                }
            });
            it(`argument specification is correct for topic ${message_constants_1.TOPIC[topic]} with action ${actionStr}`, () => {
                if (spec && spec.urp.args.indexOf('correlationId') !== -1) {
                    expect(message_validator_1.hasCorrelationId(topic, action)).toEqual(true);
                }
                else {
                    expect(message_validator_1.hasCorrelationId(topic, action)).toEqual(false);
                }
            });
        }
    }
});
//# sourceMappingURL=messagesSpec.js.map
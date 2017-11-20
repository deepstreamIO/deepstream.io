"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const message_constants_1 = require("../src/message-constants");
const message_builder_1 = require("../src/message-builder");
const message_parser_1 = require("../src/message-parser");
const messages_1 = require("./messages");
describe('message builder', () => {
    describe('specs', () => {
        for (const topicStr in messages_1.MESSAGES) {
            const topic = Number(topicStr);
            if (topic !== message_constants_1.TOPIC.CONNECTION && topic !== message_constants_1.TOPIC.AUTH && topic !== message_constants_1.TOPIC.RECORD) {
                continue;
            }
            for (const actionName in messages_1.MESSAGES[topic]) {
                const spec = messages_1.MESSAGES[topic][actionName];
                if (!spec) {
                    console.log('no spec for', message_constants_1.TOPIC[topic], actionName, '... skipping');
                    continue;
                }
                it(`builds ${message_constants_1.TOPIC[topic]} messages ${actionName} correctly`, () => {
                    const message = spec.message;
                    const binary = message_builder_1.getMessage(message, false);
                    /*
                     *console.log(
                     *  `${
                     *    JSON.stringify(binary.slice(0, 8))}${binary.toString('utf8', 8)
                     *    } should be ${
                     *      JSON.stringify(spec.urp.value.slice(0, 8))}${spec.urp.value.toString('utf8', 8)}`
                     *)
                     */
                    expect(binary).toEqual(spec.urp.value, `${binary.toString('utf8')} should be ${spec.urp.value.toString('utf8')}`);
                });
            }
        }
    });
    describe('multipart messages', () => {
        it('should build messages with very long names', () => {
            const message = {
                topic: message_constants_1.TOPIC.EVENT,
                action: message_constants_1.EVENT_ACTIONS.EMIT,
                name: 'a'.repeat(Math.pow(2, 26)),
                isAck: false,
                isError: false
            };
            const binary = message_builder_1.getMessage(message, false);
            const parseResults = message_parser_1.parse(binary);
            expect(parseResults.length).toEqual(1);
            const parsedMessage = parseResults[0];
            delete parsedMessage.data;
            expect(parsedMessage).toEqual(message);
        });
        it('should build messages with very long payloads', () => {
            const message = {
                topic: message_constants_1.TOPIC.EVENT,
                action: message_constants_1.EVENT_ACTIONS.EMIT,
                name: 'foo',
                isAck: false,
                isError: false,
                parsedData: { x: 'why'.repeat(Math.pow(2, 25)) }
            };
            const binary = message_builder_1.getMessage(message, false);
            const parseResults = message_parser_1.parse(binary);
            expect(parseResults.length).toEqual(1);
            const parsedMessage = parseResults[0];
            expect(message_parser_1.parseData(parsedMessage)).toEqual(true);
            delete parsedMessage.data;
            expect(parsedMessage).toEqual(message);
        });
    });
});
//# sourceMappingURL=message-builderSpec.js.map
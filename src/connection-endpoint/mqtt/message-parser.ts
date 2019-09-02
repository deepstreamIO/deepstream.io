import { TOPIC, EVENT_ACTION, Message, PARSER_ACTION, RECORD_ACTION } from '../../constants'

export const parseMQTT = (msg: any): Message[] => {
    let topic = TOPIC.EVENT
    if (msg.retain) {
        topic = TOPIC.RECORD
    }
    if (msg.cmd === 'subscribe') {
        const names = msg.subscriptions.map((mqttMsg: any) => mqttMsg.topic)
        return [{
            topic: TOPIC.EVENT,
            action: EVENT_ACTION.SUBSCRIBE,
            names,
            correlationId: msg.messageId
        }, {
            topic: TOPIC.RECORD,
            action: RECORD_ACTION.SUBSCRIBE,
            names,
            correlationId: msg.messageId
        }]
    }
    if (msg.cmd === 'unsubscribe') {
        const names = msg.subscriptions.map((mqttMsg: any) => mqttMsg.topic)
        return [{
            topic: TOPIC.EVENT,
            action: EVENT_ACTION.UNSUBSCRIBE,
            names,
            correlationId: msg.messageId
        }, {
            topic: TOPIC.RECORD,
            action: RECORD_ACTION.UNSUBSCRIBE,
            names,
            correlationId: msg.messageId
        }]
    }
    if (msg.cmd === 'publish') {
        if (topic === TOPIC.EVENT) {
            return [{
                topic,
                action: EVENT_ACTION.EMIT,
                name: msg.topic,
                parsedData: msg.payload.toString()
            }]
        } else if (topic === TOPIC.RECORD) {
            return [{
                topic,
                action: RECORD_ACTION.CREATEANDUPDATE,
                name: msg.topic,
                parsedData: JSON.parse(msg.payload.toString()),
                isWriteAck: msg.qos > 0,
                version: -1,
                correlationId: msg.messageId
            }, {
                topic: TOPIC.EVENT,
                action: EVENT_ACTION.EMIT,
                name: msg.topic,
                parsedData: msg.payload.toString()
            }]
        }
    }
    return [{
        topic: TOPIC.PARSER,
        action: PARSER_ACTION.INVALID_MESSAGE
    }]
}

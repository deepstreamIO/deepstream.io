import { EventEmitter } from 'events'
import { DeepstreamPlugin, DeepstreamClusterNode } from '@deepstream/types'
import { TOPIC, Message, STATE_REGISTRY_TOPIC } from '../../constants'

export default class MessageConnectorMock extends DeepstreamPlugin implements DeepstreamClusterNode {
  public description = 'Message Connector Mock'
  public lastPublishedTopic: TOPIC | STATE_REGISTRY_TOPIC | null = null
  public lastPublishedMessage: Message | null = null
  public lastSubscribedTopic: TOPIC | null = null
  public publishedMessages: Message[] = []
  public all: string[] = ['server-name-a', 'server-name-b', 'server-name-c']
  public lastDirectSentMessage: any
  public currentLeader: string = 'server-name-a'
  public eventEmitter = new EventEmitter()

  constructor (private options: any) {
    super()
    this.eventEmitter.setMaxListeners(0)
  }

  public reset () {
    this.publishedMessages = []
    this.lastPublishedTopic = null
    this.lastPublishedMessage = null
    this.lastSubscribedTopic = null

    this.all = ['server-name-a', 'server-name-b', 'server-name-c']
    this.currentLeader = 'server-name-a'
  }

  public subscribe <MessageType> (topic: TOPIC, callback: (message: MessageType, originServerName: string) => void) {
    this.lastSubscribedTopic = topic
    this.eventEmitter.on(TOPIC[topic], callback)
  }

  public sendBroadcast () {
  }

  public send (message: Message, metaData?: any) {
    this.publishedMessages.push(message)
    this.lastPublishedTopic = message.topic
    this.lastPublishedMessage = message
  }

  public sendDirect (serverName: string, message: Message) {
    this.lastDirectSentMessage = {
      serverName,
      message
    }
  }

  public unsubscribe (topic: TOPIC, callback: (message: Message) => void) {
    this.eventEmitter.removeListener(TOPIC[topic], callback)
  }

  public simulateIncomingMessage (topic: TOPIC, msg: Message, serverName: string) {
    this.eventEmitter.emit(TOPIC[topic], msg, serverName)
  }

  public getAll () {
    return this.all
  }

  public isLeader () {
    return this.currentLeader === this.options.serverName
  }

  public getLeader () {
    return this.currentLeader
  }

  public getCurrentLeader () {
    return this.currentLeader
  }

  public subscribeServerDisconnect () {

  }
}

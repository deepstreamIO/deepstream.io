import { EventEmitter } from 'events'
import { Cluster } from '../../types'
import { StateMessage } from '../../../binary-protocol/src/message-constants'
import { StateRegistry } from '../../cluster/single-state-registry';

export default class MessageConnectorMock extends EventEmitter implements Cluster {
  public lastPublishedTopic: any
  public lastPublishedMessage: any
  public lastSubscribedTopic: any
  public publishedMessages: any
  public all: any
  public lastDirectSentMessage: any
  public currentLeader: any
  public options: any
  public eventEmitter: NodeJS.EventEmitter

  constructor (options) {
    super()
    this.lastPublishedTopic = null
    this.lastPublishedMessage = null
    this.lastSubscribedTopic = null
    this.publishedMessages = []
    this.eventEmitter = new EventEmitter()
    this.eventEmitter.setMaxListeners(0)
    this.all = null
    this.currentLeader = null
    this.options = options
  }

  public reset () {
    this.publishedMessages = []
    this.lastPublishedTopic = null
    this.lastPublishedMessage = null
    this.lastSubscribedTopic = null

    this.all = ['server-name-a', 'server-name-b', 'server-name-c']
    this.currentLeader = 'server-name-a'
  }

  public subscribe (topic, callback) {
    this.lastSubscribedTopic = topic
    this.eventEmitter.on(topic, callback)
  }

  public sendBroadcast () {

  }

  public send (stateRegistryTopic, message) {
    this.publishedMessages.push(message)
    this.lastPublishedTopic = stateRegistryTopic
    this.lastPublishedMessage = JSON.parse(JSON.stringify(message))
  }

  public sendState (message: StateMessage, metaData?: any): void {
  }

  public sendStateDirect (serverName: string, message: StateMessage, metaData?: any): void {
  }

  public sendDirect (serverName, message) {
    this.lastDirectSentMessage = {
      serverName,
      message
    }
  }

  public unsubscribe (topic, callback) {
    this.eventEmitter.removeListener(topic, callback)
  }

  public simulateIncomingMessage (topic, msg, serverName) {
    this.eventEmitter.emit(topic, msg, serverName)
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

  public getStateRegistry (topic) {
    return new StateRegistry(topic, this.options)
  }

  public close () {
  }
}

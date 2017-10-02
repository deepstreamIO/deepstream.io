interface SimpleSocketWrapper extends NodeJS.EventEmitter {
  isRemote: boolean
  sendMessage: Function
  sendAckMessage: Function
  sendError: Function
}

interface SocketWrapper extends SimpleSocketWrapper {
  user: string
  uuid: number
  __id: number
  prepareMessage: Function
  finalizeMessage: Function
  sendPrepared: Function
  sendNative: Function
}

interface Message {
  topic: Topic
  action: Action
  name?: string

  isError?: boolean
  isAck?: boolean
  correlationId?: string
  data?: string
  parsedData?: any
  
  isCompleted?: boolean
  raw?: string
}

interface ListenMessage extends Message {
  subscription?: string
}

interface Plugin {
  init: Function
  isReady: Function
  setDeepstream: Function
}

interface SubscriptionListener {
  onSubscriptionRemoved: Function
  onLastSubscriptionRemoved: Function
  onSubscriptionMade: Function
  onFirstSubscriptionMade: Function
}

interface Logger {
  info: Function
  debug: Function
  warn: Function
  error: Function
}

interface Cluster {
  getStateRegistry: Function,
  send: Function,
  sendDirect: Function,
  subscribe: Function
}

interface DeepstreamOptions {
  serverName: string
  broadcastTimeout: number
  message: Cluster
  uniqueRegistry: {
  	release: Function
  	get: Function
  }
  logger: Logger,
  shuffleListenProviders: boolean,
  listenResponseTimeout: number
}

interface Provider {
  socketWrapper: SocketWrapper
  pattern: String
}

type Topic = string
type Action = string

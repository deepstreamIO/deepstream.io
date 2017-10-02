interface SimpleSocketWrapper {
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
  topic: string
  action: string
  name?: string

  isError?: boolean
  isAck?: boolean
  correlationId?: string
  data?: string
  parsedData?: any
  
  isCompleted?: boolean
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

interface DeepstreamOptions {
  serverName: string
  broadcastTimeout: number
  message: {
    getStateRegistry: Function
    send: Function
  },
  logger: {
    info: Function
    debug: Function
    warn: Function
    error: Function
  }
}
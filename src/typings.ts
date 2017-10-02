declare module "*.json" {
  const version: number;
}

type Topic = string
type Action = string
type Event = string

interface StorageRecord {
  _v: number
  _d: object
}

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
  authData: object
  prepareMessage: Function
  finalizeMessage: Function
  sendPrepared: Function
  sendNative: Function,
  parseData: Function
}

interface Message {
  topic: Topic
  action: Action
  name?: string

  isError?: boolean
  isAck?: boolean

  data?: string
  parsedData?: any
  
  raw?: string
}

interface RPCMessage extends Message {
  correlationId?: string
  isCompleted?: boolean
}

interface PresenceMessage extends Message {
  correlationId?: string
}

interface ListenMessage extends Message {
  subscription?: string
}

interface RecordMessage extends Message {
  path?: string
  version?: number
  isWriteAck?: boolean
}

interface Plugin extends NodeJS.EventEmitter {
  init?: Function
  isReady: boolean
  setDeepstream?: Function
  description: string
  close?: Function
}

interface StoragePlugin extends Plugin {
  set: Function
  get: Function
  delete: Function
}

interface SubscriptionListener {
  onSubscriptionRemoved: Function
  onLastSubscriptionRemoved: Function
  onSubscriptionMade: Function
  onFirstSubscriptionMade: Function
}

interface Logger extends Plugin {
  info: Function
  debug: Function
  warn: Function
  error: Function
}

interface Cluster {
  getStateRegistry: Function,
  send: Function,
  sendDirect: Function,
  subscribe: Function,
  close: Function
}

interface DeepstreamOptions {
  showLogo: boolean
  logLevel: number
  serverName: string
  externalUrl: string
  sslKey: string
  sslCert: string
  sslCa: string
  auth: any
  permission: any
  connectionEndpoints: any
  cache: any
  storage: any
  permissionHandler: any
  storageExclusion: RegExp

  pluginTypes: Array<string>
  rpcAckTimeout: number
  rpcTimeout: number
  cacheRetrievalTimeout: number
  storageRetrievalTimeout: number
  storageHotPathPatterns: Array<string>
  dependencyInitialisationTimeout: number
  stateReconciliationTimeout: number
  clusterKeepAliveInterval: number
  clusterActiveCheckInterval: number
  clusterNodeInactiveTimeout: number
  listenResponseTimeout: number
  lockTimeout: number
  lockRequestTimeout: number
  broadcastTimeout: number
  message: Cluster
  uniqueRegistry: {
  	release: Function
  	get: Function
  }
  logger: Logger,
  shuffleListenProviders: boolean,
}

interface Provider {
  socketWrapper: SocketWrapper
  pattern: String
}

declare module NodeJS  {
  interface Global {
    deepstreamLibDir: string
  }
}

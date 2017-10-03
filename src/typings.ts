declare module "*.json" {
  const version: number;
}

type RuleType = string
type ValveSection = string

type Topic = string
type Action = string

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
  name: string

  isError?: boolean
  isAck?: boolean

  data?: string
  parsedData?: any
  
  raw?: string
}

interface RPCMessage extends Message {
  correlationId: string
  isCompleted: boolean
}

interface PresenceMessage extends Message {
  correlationId: string
}

interface ListenMessage {
  topic: Topic
  action: Action
  name: string
  subscription: string

  raw?: string
}

interface RecordMessage extends Message {
}

interface RecordWriteMessage extends Message {
  path: string
  version: number
  isWriteAck: boolean
}

interface RecordAckMessage extends Message {
  path: string
  version: number
  isWriteAck: boolean
}

interface DeepstreamPlugin extends NodeJS.EventEmitter {
  init?: Function
  isReady: boolean
  setDeepstream?: Function
  close?: Function
  setRecordHandler?: Function
  description: string
}

interface StoragePlugin extends DeepstreamPlugin {
  set: Function
  get: Function
  delete: Function
}

interface PermissionHandler extends DeepstreamPlugin {
  canPerformAction: Function
}

interface AuthenticationHandler extends DeepstreamPlugin {
  isValidUser: Function
}

interface SubscriptionListener {
  onSubscriptionRemoved: Function
  onLastSubscriptionRemoved: Function
  onSubscriptionMade: Function
  onFirstSubscriptionMade: Function
}

interface Logger extends DeepstreamPlugin {
  setLogLevel: Function
  info: Function
  debug: Function
  warn: Function
  error: Function
  log?: Function
}

interface ConnectionEndpoint extends DeepstreamPlugin {
  onMessages: Function
  close: Function
}

interface PluginConfig {
  name?: string
  path?: string
  type?: string
  options: any
}

interface Cluster {
  getStateRegistry: Function,
  send: Function,
  sendDirect: Function,
  subscribe: Function,
  close: Function
}

interface DeepstreamConfig {
  showLogo: boolean
  libDir: string | null
  logLevel: number
  serverName: string
  externalUrl: string | null
  sslKey: string | null
  sslCert: string | null
  sslCa: string | null
  connectionEndpoints: any

  plugins: {
    cache: PluginConfig
    storage: PluginConfig
  }

  logger: PluginConfig
  auth: PluginConfig
  permission: PluginConfig

  storageExclusion: RegExp | null
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
  shuffleListenProviders: boolean
}

interface DeepstreamServices {
  registeredPlugins: Array<string>
  connectionEndpoints: Array<ConnectionEndpoint>
  cache: StoragePlugin
  storage: StoragePlugin
  permissionHandler: PermissionHandler
  authenticationHandler: AuthenticationHandler
  logger: Logger
  message: Cluster
  uniqueRegistry: {
    release: Function
    get: Function
  }
}

interface ValveConfig {
  cacheEvacuationInterval: number
  maxRuleIterations: number
  path: string
}

interface Provider {
  socketWrapper: SocketWrapper
  pattern: String
}

declare module NodeJS  {
  interface Global {
    deepstreamLibDir: string
    deepstreamCLI: string
    deepstreamConfDir: string
    require: Function
  }
}

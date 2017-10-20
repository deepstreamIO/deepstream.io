declare module '*.json' {
  const version: number
}

type RuleType = string
type ValveSection = string

type LOG_LEVEL = any
type TOPIC = any
type RECORD_ACTIONS = any
type PRESENCE_ACTIONS = any
type EVENT_ACTIONS = any
type RPC_ACTIONS = any
type AUTH_ACTIONS = any
type CONNECTION_ACTIONS = any
type EVENT = any

interface StorageRecord {
  _v: number
  _d: object
}

interface SimpleSocketWrapper extends NodeJS.EventEmitter {
  user: string
  isRemote: boolean
  sendMessage (message: { topic: TOPIC, action: CONNECTION_ACTIONS } | Message | ListenMessage | RPCMessage | PresenceMessage | RecordWriteMessage | RecordAckMessage, buffer?: boolean): void
  sendAckMessage (message: { topic: TOPIC } | Message | RPCMessage, buffer?: boolean): void
  sendError (message: { topic: TOPIC } | Message | ListenMessage | RPCMessage | PresenceMessage | RecordWriteMessage | RecordAckMessage, event: EVENT, errorMessage?: string, buffer?: boolean): void
}

interface SocketWrapper extends SimpleSocketWrapper {
  uuid: number
  __id: number
  authData: object
  getHandshakeData: Function
  onMessage: Function
  authCallback: Function
  prepareMessage: Function
  finalizeMessage: Function
  sendPrepared: Function
  sendNative: Function
  parseData: Function
  flush: Function
  destroy: Function
}

interface Message {
  topic: TOPIC
  action: RECORD_ACTIONS | PRESENCE_ACTIONS | RPC_ACTIONS | EVENT_ACTIONS | AUTH_ACTIONS | CONNECTION_ACTIONS
  name: string

  isError?: boolean
  isAck?: boolean

  data?: string
  parseError?: boolean
  parsedData?: any

  raw?: string
}

interface RPCMessage extends Message {
  correlationId: string
}

interface PresenceMessage extends Message {
  correlationId: string
}

interface ListenMessage extends Message {
  action: RECORD_ACTIONS | EVENT_ACTIONS
  name: string
  subscription: string

  raw?: string
}

// tslint:disable-next-line:no-empty-interface
interface RecordMessage extends Message {
}

interface RecordWriteMessage extends Message {
  version: number
  isWriteAck: boolean
  path?: string
}

interface RecordAckMessage extends Message {
  path?: string
  data: any
}

interface JifMessage {
  done: boolean
  message: JifResult
}

interface JifResult {
  success: boolean
  data?: any
  error?: string
  version?: number
  users?: Array<string>
  errorTopic?: string
  errorAction?: string
  errorEvent?: EVENT
}

interface SubscriptionListener {
  onSubscriptionRemoved (name: string, socketWrapper: SocketWrapper)
  onLastSubscriptionRemoved (name: string)
  onSubscriptionMade (name: string, socketWrapper: SocketWrapper)
  onFirstSubscriptionMade (name: string)
}

interface Logger extends DeepstreamPlugin {
  setLogLevel (logLevel: number)
  info (event: EVENT, message?: string, metaData?: any): void
  debug (event: EVENT, message?: string, metaData?: any): void
  warn (event: EVENT, message?: string, metaData?: any): void
  error (event: EVENT, message?: string, metaData?: any): void
  log (level: LOG_LEVEL, event: EVENT, message: string, metaData?: any): void
}

interface ConnectionEndpoint extends DeepstreamPlugin {
  onMessages (socketWrapper: SocketWrapper, messages: Array<Message>): void
  close (): void
  scheduleFlush? (socketWrapper: SocketWrapper)
}

interface PluginConfig {
  name?: string
  path?: string
  type?: string
  options: any
}

interface DeepstreamPlugin extends NodeJS.EventEmitter {
  isReady: boolean
  description: string
  init? (): void
  close? (): void
  setDeepstream? (deepstream: any): void
  setRecordHandler? (recordHandler: any): void
}

type StorageReadCallback = (error: Error | null, result: StorageRecord) => void
type StorageWriteCallback = (error: Error | null) => void

interface StoragePlugin extends DeepstreamPlugin {
  set (recordName: string, data: any, callback: StorageWriteCallback, metaData: any): void
  get (recordName: string, callback: StorageReadCallback, metaData: any): void
  delete (recordName: string, callback: StorageWriteCallback, metaData: any): void
}

interface PermissionHandler extends DeepstreamPlugin {
  canPerformAction (username: string, message: Message, callback: Function, authData: any, socketWrapper: SocketWrapper): void
}

interface AuthenticationHandler extends DeepstreamPlugin {
  isValidUser (connectionData: any, authData: any, callback: UserAuthenticationCallback)
  onClientDisconnect? (username: string)
}

interface UserAuthenticationCallback {
  (isValid: boolean, clientData?: any)
}

interface Cluster {
  getStateRegistry (stateRegistryName: TOPIC): any,
  send (message: Message, metaData: any): void,
  sendDirect (serverName: string, message: Message, metaData: any): void,
  subscribe (topic: TOPIC, callback: Function): void
  isLeader (): boolean
  close (callback: Function): void
}

interface LockRegistry {
  get (lock: string, callback: Function)
  release (lock: string)
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
  uniqueRegistry: LockRegistry
}

interface ValveConfig {
  cacheEvacuationInterval: number
  maxRuleIterations: number
  path: string
}

interface Provider {
  socketWrapper: SocketWrapper
  pattern: string
}

interface UserData {
 clientData: any
 serverData: any
}

// tslint:disable-next-line:no-namespace
declare namespace NodeJS  {
  interface Global {
    deepstreamCLI: any
    deepstreamLibDir: string | null
    deepstreamConfDir: string | null
    require (path: string): any
  }
}

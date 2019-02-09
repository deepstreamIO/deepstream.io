declare module '*.json' {
  const version: number
}

type RuleType = string
type ValveSection = string

type LOG_LEVEL = any
type TOPIC = number
type EVENT = any

interface SimpleSocketWrapper extends NodeJS.EventEmitter {
  user: string
  isRemote: boolean
  sendNativeMessage (message: any, buffer?: boolean): void
  sendMessage (message: Message, buffer?: boolean): void
  sendAckMessage (message: Message, buffer?: boolean): void
  clientData?: object | null
}

interface SocketWrapper extends SimpleSocketWrapper {
  uuid: number
  authData: object
  isClosed: boolean
  clientData: object | null
  getHandshakeData: Function
  onMessage: Function
  authCallback: Function
  getMessage: Function
  parseData: Function
  flush: Function
  destroy: Function
}

interface Message {
  topic: TOPIC
  action: number
  name?: string

  isError?: boolean
  isAck?: boolean

  data?: string | Buffer
  parsedData?: any

  originalTopic?: number
  originalAction?: number
  subscription?: string
  names?: Array<string>
  isWriteAck?: boolean
  correlationId?: string
  path?: string
  version?: number
  reason?: string
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

type StorageReadCallback = (error: string | null, version: number, result: any) => void
type StorageWriteCallback = (error: string | null) => void

interface StoragePlugin extends DeepstreamPlugin {
  apiVersion?: number
  set (recordName: string, version: number, data: any, callback: StorageWriteCallback, metaData?: any): void
  get (recordName: string, callback: StorageReadCallback, metaData?: any): void
  delete (recordName: string, callback: StorageWriteCallback, metaData?: any): void
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
  getStateRegistry (stateRegistryTopic: TOPIC): any,
  send (stateRegistryTopic: TOPIC, message: Message, metaData?: any): void,
  sendDirect (serverName: string, message: Message, metaData?: any): void,
  subscribe (stateRegistryTopic: TOPIC, callback: Function): void
  isLeader (): boolean
  close (callback: Function): void
}

interface LockRegistry {
  get (lock: string, callback: Function)
  release (lock: string)
}

interface DeepstreamConfig {
  showLogo?: boolean
  libDir?: string | null
  logLevel?: number
  serverName?: string
  externalUrl?: string | null
  sslKey?: string | null
  sslCert?: string | null
  sslCa?: string | null
  connectionEndpoints?: any

  plugins?: {
    cache?: PluginConfig
    storage?: PluginConfig
  }

  logger?: PluginConfig
  auth?: PluginConfig
  permission?: PluginConfig

  storageExclusionPrefixes?: Array<string>
  provideRPCRequestorDetails?: boolean
  rpcAckTimeout?: number
  rpcTimeout?: number
  cacheRetrievalTimeout?: number
  storageRetrievalTimeout?: number
  storageHotPathPrefixes?: Array<string>
  dependencyInitialisationTimeout?: number
  stateReconciliationTimeout?: number
  clusterKeepAliveInterval?: number
  clusterActiveCheckInterval?: number
  clusterNodeInactiveTimeout?: number
  listenResponseTimeout?: number
  lockTimeout?: number
  lockRequestTimeout?: number
  broadcastTimeout?: number
  shuffleListenProviders?: boolean
}

interface InternalDeepstreamConfig {
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

  storageExclusionPrefixes: Array<string>
  provideRPCRequestorDetails: boolean
  provideRPCRequestorName: boolean
  provideRPCRequestorData: boolean
  rpcAckTimeout: number
  rpcTimeout: number
  cacheRetrievalTimeout: number
  storageRetrievalTimeout: number
  storageHotPathPrefixes: Array<string>
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
  closeListener?: () => void
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

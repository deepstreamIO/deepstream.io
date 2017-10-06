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
  sendMessage(message: Message | ListenMessage | RPCMessage | PresenceMessage | RecordWriteMessage | RecordAckMessage, buffer?: boolean): void
  sendAckMessage(message: Message | RPCMessage ): void
  sendError(message: { topic: string } | Message | ListenMessage | RPCMessage | PresenceMessage | RecordWriteMessage | RecordAckMessage, event: string, errorMessage?: string): void
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
  isCompleted?: boolean
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
  version: number
  isWriteAck: boolean
  path?: string
}

interface RecordAckMessage extends Message {
  path?: string
  data: any
}

interface SubscriptionListener {
  onSubscriptionRemoved(name: string, socketWrapper: SocketWrapper)
  onLastSubscriptionRemoved(name: string)
  onSubscriptionMade(name: string, socketWrapper: SocketWrapper)
  onFirstSubscriptionMade(name: string)
}

interface Logger extends DeepstreamPlugin {
  setLogLevel(logLevel: number)
  info(event: string, message?: string, metaData?: any): void
  debug(event: string, message?: string, metaData?: any): void
  warn(event: string, message?: string, metaData?: any): void
  error(event: string, message?: string, metaData?: any): void
  log(level: number, event: string, message: string, metaData?: any): void
}

interface ConnectionEndpoint extends DeepstreamPlugin {
  onMessages(messages: Array<Message>): void
  close(): void
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
  init?(): void
  close?(): void
  setDeepstream?(deepstream: any): void
  setRecordHandler?(recordHandler: any): void
}

interface StorageReadCallback {
 (error: Error | null, result: StorageRecord): void;
}

interface StorageWriteCallback {
 (error: Error | null): void;
}

interface StoragePlugin extends DeepstreamPlugin {
  set(recordName: string, data: any, callback: StorageWriteCallback, metaData: any): void
  get(recordName: string, callback: StorageReadCallback, metaData: any): void
  delete(recordName: string, callback: StorageWriteCallback, metaData: any): void
}

interface PermissionHandler extends DeepstreamPlugin {
  canPerformAction(username: string, message: Message, callback: Function, authData: any, socketWrapper: SocketWrapper): void
}

interface AuthenticationHandler extends DeepstreamPlugin {
  isValidUser(connectionData: any, authData: any, callback: Function) 
}

interface Cluster {
  getStateRegistry(stateRegistryName: string): any,
  send(message: Message, metaData: any): void,
  sendDirect(serverName: string, message: Message, metaData: any): void,
  subscribe(topic: any, callback: Function): void
  isLeader(): boolean
  close(callback: Function): void
}

interface LockRegistry {
  get(lock: string, callback: Function)
  release(lock: string)
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

declare module NodeJS  {
  interface Global {
    deepstreamLibDir: string
    deepstreamCLI: string
    deepstreamConfDir: string
    require(path: string): any
  }
}

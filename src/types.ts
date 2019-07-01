import { DeepPartial } from 'ts-essentials'
import { EventEmitter } from 'events'
import { ALL_ACTIONS, Message, JSONObject, SubscriptionMessage, EVENT, TOPIC } from '../binary-protocol/src/message-constants'

export enum LOG_LEVEL {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  OFF = 100
}

interface MessageDistributor {
  distribute (socketWrapper: SocketWrapper, message: Message): void
  registerForTopic (topic: TOPIC, callback: (message: Message, fromServer: string) => void): void
}

export type MetaData = JSONObject

export interface Handler<SpecificMessage> {
  handle (socketWrapper: SocketWrapper | null, message: SpecificMessage): void
}

export interface SimpleSocketWrapper {
  user: string | null
  isRemote?: boolean
  sendMessage (message: Message, buffer?: boolean): void
  sendAckMessage (message: Message, buffer?: boolean): void
  sendBuiltMessage? (message: any, buffer?: boolean): void
  clientData?: object | null
}

export interface StatefulSocketWrapper extends SimpleSocketWrapper {
  isClosed: boolean,
  onClose: Function,
  removeOnClose: Function
  destroy: Function
  close: Function
  authAttempts: number
}

export interface UnauthenticatedSocketWrapper extends StatefulSocketWrapper {
  uuid: number
  getHandshakeData: Function
  onMessage: Function
  authCallback: Function | null
  getMessage: Function
  parseData: Function
  flush: () => void
}

export interface SocketWrapper extends UnauthenticatedSocketWrapper {
  user: string
  authData: JSONObject | null,
  clientData: JSONObject | null
}

export interface JifMessage {
  done: boolean
  message: JifResult
}

export interface JifResult {
  success: boolean
  data?: any
  error?: string
  version?: number
  users?: string[]
  errorTopic?: string
  errorAction?: string
  errorEvent?: EVENT | string
}

export interface SubscriptionListener {
  onSubscriptionRemoved (name: string, socketWrapper: SocketWrapper): void
  onLastSubscriptionRemoved (name: string): void
  onSubscriptionMade (name: string, socketWrapper: SocketWrapper): void
  onFirstSubscriptionMade (name: string): void
}

export interface Logger extends DeepstreamPlugin {
  shouldLog (logLevel: LOG_LEVEL): boolean
  setLogLevel (logLevel: LOG_LEVEL): void
  info (event: EVENT | string, message?: string, metaData?: any): void
  debug (event: EVENT | string, message?: string, metaData?: any): void
  warn (event: EVENT | string, message?: string, metaData?: any): void
  error (event: EVENT | string, message?: string, metaData?: any): void
  log (level: LOG_LEVEL, event: EVENT, message: string, metaData?: any): void
}
export type LoggerPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: DeepstreamConfig) => Logger

export interface ConnectionEndpoint extends DeepstreamPlugin {
  onMessages (socketWrapper: SocketWrapper, messages: Message[]): void
  scheduleFlush? (socketWrapper: SocketWrapper): void
}
export type ConnectionEndpointPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: DeepstreamConfig) => ConnectionEndpoint

export interface SocketConnectionEndpoint extends ConnectionEndpoint {
  scheduleFlush (socketWrapper: SocketWrapper): void
}
export type SocketConnectionEndpointPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: DeepstreamConfig) => SocketConnectionEndpoint

export type StateRegistryCallback = (name: string) => void
export interface StateRegistry {
  has (name: string): boolean
  add (name: string): void
  remove (name: string): void

  onAdd (callback: StateRegistryCallback): void
  onRemove (callback: StateRegistryCallback): void

  getAll (serverName?: string): string[]
  getAllServers (subscriptionName: string): string[]
  removeAll (serverName: string): void

  whenReady (): Promise<void>
}

export interface StateRegistryFactory extends DeepstreamPlugin {
  getStateRegistry (topic: TOPIC): StateRegistry
}

export interface SubscriptionRegistry {
  getNames (): string[]
  getAllServers (subscriptionName: string): string[]
  getAllRemoteServers (subscriptionName: string): string[]
  hasName (subscriptionName: string): boolean
  sendToSubscribers (name: string, message: Message, noDelay: boolean, senderSocket: SocketWrapper | null, suppressRemote?: boolean): void
  subscribe (message: SubscriptionMessage, socket: SocketWrapper, silent?: boolean): void
  unsubscribe (message: SubscriptionMessage, socket: SocketWrapper, silent?: boolean): void
  getLocalSubscribers (name: string): Set<SocketWrapper>
  hasLocalSubscribers (name: string): boolean
  setSubscriptionListener (listener: SubscriptionListener): void
  setAction (subscriptionAction: string, action: ALL_ACTIONS): void
}

export interface SubscriptionRegistryFactory extends DeepstreamPlugin {
  getSubscriptionRegistry (topic: TOPIC, clusterTopic: TOPIC): SubscriptionRegistry
  getSubscriptionRegistries (): Map<TOPIC, SubscriptionRegistry>
}

export interface PluginConfig {
  name?: string
  path?: string
  type?: string
  options: any
}

export abstract class DeepstreamPlugin extends EventEmitter {
  public isReady: boolean = true
  public abstract description: string
  public init? (): void
  public async whenReady (): Promise<void> {}
  public async close (): Promise<void> {}
  public setRecordHandler? (recordHandler: any): void
}

export type StorageReadCallback = (error: string | null, version: number, result: any) => void
export type StorageWriteCallback = (error: string | null) => void
export interface Storage extends DeepstreamPlugin  {
  apiVersion?: number
  set (recordName: string, version: number, data: any, callback: StorageWriteCallback, metaData?: any): void
  get (recordName: string, callback: StorageReadCallback, metaData?: any): void
  delete (recordName: string, callback: StorageWriteCallback, metaData?: any): void
  deleteBulk (recordNames: string[], callback: StorageWriteCallback, metaData?: any): void
}
export type StoragePlugin<PluginOptions> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: DeepstreamConfig) => Storage

export interface Monitoring extends DeepstreamPlugin  {
  onErrorLog (loglevel: LOG_LEVEL, event: EVENT, logMessage: string): void
  onLogin (allowed: boolean, endpointType: string): void
  onMessageRecieved (message: Message): void
  onMessageSend (message: Message): void
  onBroadcast (message: Message, count: number): void
}
export type MonitoringPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: DeepstreamConfig) => Monitoring

export type PermissionCallback = (socketWrapper: SocketWrapper, message: Message, passItOn: any, error: Error | string | ALL_ACTIONS | null, result: boolean) => void
export interface Permission extends DeepstreamPlugin {
  canPerformAction (username: string, message: Message, callback: PermissionCallback, authData: JSONObject, socketWrapper: SocketWrapper, passItOn: any): void
}

export interface UserAuthData {
  username?: string,
  token?: string,
  clientData?: JSONObject,
  serverData?: JSONObject
}
export type UserAuthenticationCallback = (isValid: boolean, userAuthData?: UserAuthData) => void
export interface Authentication extends DeepstreamPlugin  {
  isValidUser (connectionData: any, authData: any, callback: UserAuthenticationCallback): void
  onClientDisconnect? (username: string): void
}

export interface ClusterNode extends DeepstreamPlugin  {
  send (message: Message, metaData?: any): void
  sendDirect (serverName: string, message: Message, metaData?: any): void
  subscribe<SpecificMessage> (stateRegistryTopic: TOPIC, callback: (message: SpecificMessage, originServerName: string) => void): void
  close (): Promise<void>
}
export type ClusterNodePlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: DeepstreamConfig) => ClusterNode

export type LockCallback = (locked: boolean) => void
export interface LockRegistry extends DeepstreamPlugin  {
  get (lock: string, callback: LockCallback): void
  release (lock: string): void
}
export type LockRegistryPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: DeepstreamConfig) => LockRegistry

export interface ClusterRegistry extends DeepstreamPlugin {
  isLeader (): boolean
  getLeader (): string
}
export type ClusterRegistryPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: DeepstreamConfig) => ClusterRegistry

export type PartialDeepstreamConfig = DeepPartial<DeepstreamConfig>

export interface DeepstreamConfig {
  showLogo: boolean
  libDir: string | null
  logLevel: number
  serverName: string
  dependencyInitialisationTimeout: number
  exitOnPluginError: boolean

  externalUrl: string | null
  sslKey: string | null
  sslCert: string | null
  sslDHParams: string | null
  sslPassphrase: string | null

  connectionEndpoints: { [index: string]: PluginConfig }

  subscriptions: PluginConfig,
  logger: PluginConfig
  auth: PluginConfig
  permission: PluginConfig
  cache: PluginConfig
  storage: PluginConfig
  monitoring: PluginConfig
  locks: PluginConfig
  clusterNode: PluginConfig
  clusterStates: PluginConfig
  clusterRegistry: PluginConfig

  plugins: { [index: string]: PluginConfig }

  record: {
    storageHotPathPrefixes: string[]
    storageExclusionPrefixes: string[]
    storageRetrievalTimeout: number
    cacheRetrievalTimeout: number
  },

  rpc: {
    provideRequestorName: boolean
    provideRequestorData: boolean
    ackTimeout: number
    responseTimeout: number
  },

  listen: {
    responseTimeout: number
    shuffleProviders: boolean
    rematchInterval: number
    matchCooldown: number
  }
}

export interface DeepstreamServices {
  connectionEndpoints: ConnectionEndpoint[]
  cache: Storage
  storage: Storage
  monitoring: Monitoring
  permission: Permission
  authentication: Authentication
  logger: Logger
  clusterNode: ClusterNode
  locks: LockRegistry,
  clusterRegistry: ClusterRegistry,
  subscriptions: SubscriptionRegistryFactory,
  clusterStates: StateRegistryFactory,
  messageDistributor: MessageDistributor
  plugins: { [index: string]: DeepstreamPlugin }
}

export interface ValveConfig {
  cacheEvacuationInterval: number
  maxRuleIterations: number
  path: string
}

export interface Provider {
  socketWrapper: SocketWrapper
  pattern: string
  closeListener?: () => void,
  responseTimeout?: NodeJS.Timeout
}

export interface UserData {
  clientData: any
  serverData: any
}

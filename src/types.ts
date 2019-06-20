import { EventEmitter } from 'events'
import { TOPIC, EVENT, LOG_LEVEL } from './constants'
import { SubscriptionRegistryFactory } from './utils/SubscriptionRegistryFactory'
import { Deepstream } from './deepstream.io'
import { ALL_ACTIONS, Message, JSONObject } from '../binary-protocol/src/message-constants'
import MessageDistributor from './message/message-distributor'
import { DeepPartial } from 'ts-essentials'

export type MetaData = JSONObject
export type RuleType = string
export type ValveSection = string

export interface Handler<SpecificMessage> {
  handle (socketWrapper: SocketWrapper | null, message: SpecificMessage): void
}

export interface SimpleSocketWrapper {
  user: string | null
  isRemote?: boolean
  sendMessage (message: Message, buffer?: boolean): void
  sendAckMessage (message: Message, buffer?: boolean): void
  sendBinaryMessage? (message: Buffer, buffer?: boolean): void
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
  flush: Function
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
export type LoggerPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: InternalDeepstreamConfig) => Logger

export interface ConnectionEndpoint extends DeepstreamPlugin {
  onMessages (socketWrapper: SocketWrapper, messages: Message[]): void
  scheduleFlush? (socketWrapper: SocketWrapper): void
}
export type ConnectionEndpointPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: InternalDeepstreamConfig) => ConnectionEndpoint

export interface SocketConnectionEndpoint extends ConnectionEndpoint {
  scheduleFlush (socketWrapper: SocketWrapper): void
}
export type SocketConnectionEndpointPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: InternalDeepstreamConfig) => SocketConnectionEndpoint

export type StateRegistryCallback = (name: string) => void
export interface StateRegistry extends DeepstreamPlugin {
  has (name: string): boolean
  add (name: string): void
  remove (name: string): void

  onAdd (callback: StateRegistryCallback): void
  onRemove (callback: StateRegistryCallback): void

  getAll (serverName?: string): string[]
  getAllServers (subscriptionName: string): string[]
  removeAll (serverName: string): void
}
export type StateRegistryPlugin<PluginOptions = any> = new (topic: TOPIC, pluginConfig: PluginOptions, services: DeepstreamServices, config: InternalDeepstreamConfig) => StateRegistry

export interface PluginConfig {
  name?: string
  path?: string
  type?: string
  options: any
}

export type MonitorHookCallback = () => void
export abstract class DeepstreamPlugin extends EventEmitter {
  public isReady: boolean = true
  public abstract description: string
  public apiVersion?: number
  public init? (): void
  public async whenReady (): Promise<void> {}
  public async close (): Promise<void> {}
  public setDeepstream? (deepstream: Deepstream): void
  public setRecordHandler? (recordHandler: any): void
  public registerMonitorHook? (cb: MonitorHookCallback): void
}

export type StorageReadCallback = (error: string | null, version: number, result: any) => void
export type StorageWriteCallback = (error: string | null) => void
export interface Storage extends DeepstreamPlugin  {
  set (recordName: string, version: number, data: any, callback: StorageWriteCallback, metaData?: any): void
  get (recordName: string, callback: StorageReadCallback, metaData?: any): void
  delete (recordName: string, callback: StorageWriteCallback, metaData?: any): void
}
export type StoragePlugin<PluginOptions> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: InternalDeepstreamConfig) => Storage

export interface Monitoring extends DeepstreamPlugin  {
  onErrorLog (loglevel: LOG_LEVEL, event: EVENT, logMessage: string): void
  onLogin (allowed: boolean, endpointType: string): void
  onMessageRecieved (message: Message): void
  onMessageSend (message: Message): void
  onBroadcast (message: Message, count: number): void
}
export type MonitoringPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: InternalDeepstreamConfig) => Monitoring

export type PermissionCallback = (socketWrapper: SocketWrapper, message: Message, passItOn: any, error: Error | string | ALL_ACTIONS | null, result: boolean) => void
export interface PermissionHandler extends DeepstreamPlugin {
  canPerformAction (username: string, message: Message, callback: PermissionCallback, authData: JSONObject, socketWrapper: SocketWrapper, passItOn: any): void
}
export type PermissionHandlerPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: InternalDeepstreamConfig) => PermissionHandler

export interface UserAuthData {
  username?: string,
  token?: string,
  clientData?: JSONObject,
  serverData?: JSONObject
}
export type UserAuthenticationCallback = (isValid: boolean, userAuthData?: UserAuthData) => void
export interface AuthenticationHandler extends DeepstreamPlugin  {
  isValidUser (connectionData: any, authData: any, callback: UserAuthenticationCallback): void
  onClientDisconnect? (username: string): void
}
export type AuthenticationHandlerPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: InternalDeepstreamConfig) => AuthenticationHandler

export interface ClusterNode extends DeepstreamPlugin  {
  getGlobalStateRegistry (): StateRegistry
  getStateRegistry (stateRegistryTopic: TOPIC): StateRegistry
  send (message: Message, metaData?: any): void
  sendDirect (serverName: string, message: Message, metaData?: any): void
  subscribe<SpecificMessage> (stateRegistryTopic: TOPIC, callback: (message: SpecificMessage, originServerName: string) => void): void
  close (): Promise<void>
}
export type ClusterNodePlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: InternalDeepstreamConfig) => ClusterNode

export type LockCallback = (locked: boolean) => void
export interface LockRegistry extends DeepstreamPlugin  {
  get (lock: string, callback: LockCallback): void
  release (lock: string): void
}
export type LockRegistryPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: InternalDeepstreamConfig) => LockRegistry

export interface ClusterRegistry extends DeepstreamPlugin {
  isLeader (): boolean
  getLeader (): string
}
export type ClusterRegistryPlugin<PluginOptions = any> = new (pluginConfig: PluginOptions, services: DeepstreamServices, config: InternalDeepstreamConfig) => ClusterRegistry

export type DeepstreamConfig = DeepPartial<InternalDeepstreamConfig>

export interface InternalDeepstreamConfig {
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

  logger: PluginConfig
  auth: PluginConfig
  permission: PluginConfig
  cache: PluginConfig
  storage: PluginConfig
  monitoring: PluginConfig

  cluster: {
    message: PluginConfig
    state: PluginConfig
    registry: PluginConfig
    locks: PluginConfig
  }

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
  permissionHandler: PermissionHandler
  authenticationHandler: AuthenticationHandler
  logger: Logger
  message: ClusterNode
  locks: LockRegistry,
  cluster: ClusterRegistry,
  subscriptions: SubscriptionRegistryFactory,
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

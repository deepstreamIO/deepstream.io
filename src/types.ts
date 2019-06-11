import { EventEmitter } from 'events'
import { TOPIC, EVENT, LOG_LEVEL } from './constants'
import { SubscriptionRegistryFactory } from './utils/SubscriptionRegistryFactory'
import { Deepstream } from './deepstream.io'
import { ALL_ACTIONS } from '../binary-protocol/src/message-constants'

export type RuleType = string
export type ValveSection = string

export interface SimpleSocketWrapper {
  user: string
  isRemote: boolean
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
}

export interface SocketWrapper extends StatefulSocketWrapper {
  uuid: number
  authData: object
  clientData: object | null
  getHandshakeData: Function
  onMessage: Function
  authCallback: Function
  getMessage: Function
  parseData: Function
  flush: Function
}

export interface Message {
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
  names?: string[]
  isWriteAck?: boolean
  correlationId?: string
  path?: string
  version?: number
  reason?: string
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

export interface ConnectionEndpoint extends DeepstreamPlugin {
  onMessages (socketWrapper: SocketWrapper, messages: Message[]): void
  close (): void
  scheduleFlush? (socketWrapper: SocketWrapper)
}

export interface SocketConnectionEndpoint extends ConnectionEndpoint {
  scheduleFlush (socketWrapper: SocketWrapper)
}

export interface PluginConfig {
  name?: string
  path?: string
  type?: string
  options: any
}

export type MonitorHookCallback = () => void

export class DeepstreamPlugin extends EventEmitter {
  constructor () {
    super()
  }
  public isReady: boolean
  public description: string
  public init? (): void
  public close? (): void
  public setDeepstream? (deepstream: Deepstream): void
  public setRecordHandler? (recordHandler: any): void
  public registerMonitorHook? (cb: MonitorHookCallback)
}

export type StorageReadCallback = (error: string | null, version: number, result: any) => void
export type StorageWriteCallback = (error: string | null) => void

export interface StoragePlugin extends DeepstreamPlugin {
  apiVersion?: number
  set (recordName: string, version: number, data: any, callback: StorageWriteCallback, metaData?: any): void
  get (recordName: string, callback: StorageReadCallback, metaData?: any): void
  delete (recordName: string, callback: StorageWriteCallback, metaData?: any): void
}

export interface MonitoringPlugin extends DeepstreamPlugin {
  apiVersion?: number
  onErrorLog (loglevel: LOG_LEVEL, event: EVENT, logMessage: string): void
  onLogin (allowed: boolean, endpointType: string): void
  onMessageRecieved (message: Message): void
  onMessageSend (message: Message): void
  onBroadcast (message: Message, count: number): void
}

export type PermissionCallback = (socketWrapper: SocketWrapper, message: Message, error: Error | string | ALL_ACTIONS | null, result: boolean) => void
export interface PermissionHandler extends DeepstreamPlugin {
  canPerformAction (username: string, message: Message, callback: PermissionCallback, authData: any, socketWrapper: SocketWrapper): void
}

export interface AuthenticationHandler extends DeepstreamPlugin {
  isValidUser (connectionData: any, authData: any, callback: UserAuthenticationCallback)
  onClientDisconnect? (username: string)
}

export interface UserAuthenticationCallback {
  (isValid: boolean, clientData?: any)
}

export interface Cluster {
  getStateRegistry (stateRegistryTopic: TOPIC): any,
  send (stateRegistryTopic: TOPIC, message: Message, metaData?: any): void,
  sendDirect (serverName: string, message: Message, metaData?: any): void,
  subscribe (stateRegistryTopic: TOPIC, callback: Function): void
  isLeader (): boolean
  getLeader (): string
  close (callback: Function): void
}

export interface LockRegistry {
  get (lock: string, callback: Function)
  release (lock: string)
}

export interface DeepstreamConfig {
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
    monitoring?: PluginConfig
  }

  logger?: PluginConfig
  auth?: PluginConfig
  permission?: PluginConfig

  unauthenticatedClientTimeout?: number
  maxAuthAttempts?: number
  storageExclusionPrefixes?: string[]
  provideRPCRequestorDetails?: boolean
  rpcAckTimeout?: number
  rpcTimeout?: number
  cacheRetrievalTimeout?: number
  storageRetrievalTimeout?: number
  storageHotPathPrefixes?: string[]
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

export interface InternalDeepstreamConfig {
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
    monitoring: PluginConfig
  }

  logger: PluginConfig
  auth: PluginConfig
  permission: PluginConfig

  storageExclusionPrefixes: string[]
  provideRPCRequestorDetails: boolean
  provideRPCRequestorName: boolean
  provideRPCRequestorData: boolean
  rpcAckTimeout: number
  rpcTimeout: number
  cacheRetrievalTimeout: number
  storageRetrievalTimeout: number
  storageHotPathPrefixes: string[]
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
  exitOnPluginError: boolean
}

export interface DeepstreamServices {
  registeredPlugins: string[]
  connectionEndpoints: ConnectionEndpoint[]
  cache: StoragePlugin
  storage: StoragePlugin
  monitoring: MonitoringPlugin
  permissionHandler: PermissionHandler
  authenticationHandler: AuthenticationHandler
  logger: Logger
  message: Cluster
  uniqueRegistry: LockRegistry,
  subscriptions: SubscriptionRegistryFactory
}

export interface ValveConfig {
  cacheEvacuationInterval: number
  maxRuleIterations: number
  path: string
}

export interface Provider {
  socketWrapper: SocketWrapper
  pattern: string
  closeListener?: () => void
}

export interface UserData {
  clientData: any
  serverData: any
}

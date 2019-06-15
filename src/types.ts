import { EventEmitter } from 'events'
import { TOPIC, EVENT, LOG_LEVEL } from './constants'
import { SubscriptionRegistryFactory } from './utils/SubscriptionRegistryFactory'
import { Deepstream } from './deepstream.io'
import { ALL_ACTIONS, StateMessage, Message, JSONObject } from '../binary-protocol/src/message-constants'

export type MetaData = JSONObject
export type RuleType = string
export type ValveSection = string

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
}

export interface UnauthenticatedSocketWrapper extends StatefulSocketWrapper {
  uuid: number
  authData: object | null
  clientData: object | null
  getHandshakeData: Function
  onMessage: Function
  authCallback: Function | null
  getMessage: Function
  parseData: Function
  flush: Function
}

export interface SocketWrapper extends UnauthenticatedSocketWrapper {
  user: string
  authCallback: Function
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
  scheduleFlush? (socketWrapper: SocketWrapper): void
}

export interface SocketConnectionEndpoint extends ConnectionEndpoint {
  scheduleFlush (socketWrapper: SocketWrapper): void
}

export interface StateRegistry extends EventEmitter {
  has (name: string): boolean
  add (name: string): void
  remove (name: string): void

  getAll (): string[]
  getAllMap (): Map<string, number>
  whenReady (callback: () => void): void
  getAllServers (subscriptionName: string): string[]
  removeAll (serverName: string): void
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
  public isReady: boolean = false
  public description: string = 'Deepstream Plugin'
  public init? (): void
  public close? (): void
  public setDeepstream? (deepstream: Deepstream): void
  public setRecordHandler? (recordHandler: any): void
  public registerMonitorHook? (cb: MonitorHookCallback): void
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

export type PermissionCallback = (socketWrapper: SocketWrapper, message: Message, passItOn: any, error: Error | string | ALL_ACTIONS | null, result: boolean) => void
export interface PermissionHandler extends DeepstreamPlugin {
  canPerformAction (username: string, message: Message, callback: PermissionCallback, authData: any, socketWrapper: SocketWrapper, passItOn: any): void
}

export interface AuthenticationHandler extends DeepstreamPlugin {
  isValidUser (connectionData: any, authData: any, callback: UserAuthenticationCallback): void
  onClientDisconnect? (username: string): void
}

export type UserAuthenticationCallback = (isValid: boolean, clientData?: any) => void

export interface Cluster {
  getStateRegistry (stateRegistryTopic: TOPIC): any,
  sendStateDirect (serverName: string, message: StateMessage, metaData?: any): void,
  sendState (message: StateMessage, metaData?: any): void,
  send (message: Message, metaData?: any): void,
  sendDirect (serverName: string, message: Message, metaData?: any): void,
  subscribe<SpecificMessage> (stateRegistryTopic: TOPIC, callback: (message: SpecificMessage, originServerName: string) => void): void
  close (callback: Function): void
}

export type LockCallback = (locked: boolean) => void

export interface LockRegistry {
  get (lock: string, callback: Function): void
  release (lock: string): void
}

export interface ClusterRegistry {
  isLeader (): boolean
  getLeader (): string
}

export type DeepstreamConfig = any // DeepPartial<InternalDeepstreamConfig>

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

  connectionEndpoints: any

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
  }
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
  locks: LockRegistry,
  cluster: ClusterRegistry,
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

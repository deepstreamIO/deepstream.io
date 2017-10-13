import { RECORD_ACTIONS, TOPIC, PARSER_ACTIONS } from '../constants'
import ListenerRegistry from '../listen/listener-registry'
import SubscriptionRegistry from '../utils/subscription-registry'
import RecordDeletion from './record-deletion'
import recordRequest from './record-request'
import RecordTransition from './record-transition'

export default class RecordHandler {
  private metaData: any
  private config: DeepstreamConfig
  private services: DeepstreamServices
  private subscriptionRegistry: SubscriptionRegistry
  private listenerRegistry: ListenerRegistry
  private transitions: any
  private recordRequestsInProgress: any
/**
 * The entry point for record related operations
 */
  constructor (config: DeepstreamConfig, services: DeepstreamServices, subscriptionRegistry?: SubscriptionRegistry, listenerRegistry?: ListenerRegistry, metaData?: any) {
    this.metaData = metaData
    this.config = config
    this.services = services
    this.subscriptionRegistry =
    subscriptionRegistry || new SubscriptionRegistry(config, services, TOPIC.RECORD, TOPIC.RECORD_SUBSCRIPTIONS)
    this.listenerRegistry =
    listenerRegistry || new ListenerRegistry(TOPIC.RECORD, config, services, this.subscriptionRegistry, null)
    this.subscriptionRegistry.setSubscriptionListener(this.listenerRegistry)
    this.transitions = {}
    this.recordRequestsInProgress = {}
  }

/**
 * Handles incoming record requests.
 *
 * Please note that neither CREATE nor READ is supported as a
 * client send action. Instead the client sends CREATEORREAD
 * and deepstream works which one it will be
 */
  public handle (socketWrapper: SocketWrapper, message: RecordMessage): void {
    if (message.action === RECORD_ACTIONS.SUBSCRIBECREATEANDREAD) {
    /*
     * Return the record's contents and subscribes for future updates.
     * Creates the record if it doesn't exist
     */
      this.createOrRead(socketWrapper, message)
    } else if (message.action === RECORD_ACTIONS.CREATEANDUPDATE) {
    /*
     * Allows updates to the record without being subscribed, creates
     * the record if it doesn't exist
     */
      this.createAndUpdate(socketWrapper, message as RecordWriteMessage)
    } else if (message.action === RECORD_ACTIONS.READ) {
    /*
     * Return the current state of the record in cache or db
     */
      this.snapshot(socketWrapper, message)
    } else if (message.action === RECORD_ACTIONS.HEAD) {
    /*
     * Return the current state of the record in cache or db
     */
      this.head(socketWrapper, message)
    } else if (message.action === RECORD_ACTIONS.HAS) {
    /*
     * Return a Boolean to indicate if record exists in cache or database
     */
      this.hasRecord(socketWrapper, message)
    } else if (message.action === RECORD_ACTIONS.UPDATE || message.action === RECORD_ACTIONS.PATCH) {
    /*
     * Handle complete (UPDATE) or partial (PATCH) updates
     */
      this.update(socketWrapper, message as RecordWriteMessage, false)
    } else if (message.action === RECORD_ACTIONS.DELETE) {
    /*
     * Deletes the record
     */
      this.delete(socketWrapper, message)
    } else if (message.action === RECORD_ACTIONS.DELETE_ACK) {
    /*
     * Handle delete acknowledgement from message bus
     * TODO: Different action
     */
      this.deleteAck(socketWrapper, message)
    } else if (message.action === RECORD_ACTIONS.UNSUBSCRIBE) {
  /*
   * Unsubscribes (discards) a record that was previously subscribed to
   * using read()
   */
      this.subscriptionRegistry.unsubscribe(message, socketWrapper)
    } else if (message.action === RECORD_ACTIONS.LISTEN ||
  /*
   * Listen to requests for a particular record or records
   * whose names match a pattern
   */
    message.action === RECORD_ACTIONS.UNLISTEN ||
    message.action === RECORD_ACTIONS.LISTEN_ACCEPT ||
    message.action === RECORD_ACTIONS.LISTEN_REJECT) {
      this.listenerRegistry.handle(socketWrapper, message as ListenMessage)
    } else {
      this.services.logger.error(PARSER_ACTIONS[PARSER_ACTIONS.UNKNOWN_ACTION], RECORD_ACTIONS[message.action], this.metaData)
    }
  }

/**
 * Tries to retrieve the record from the cache or storage. If not found in either
 * returns false, otherwise returns true.
 */
  private hasRecord (socketWrapper: SocketWrapper, message: RecordMessage): void {
    function onComplete (record, recordName, socket) {
      socket.sendMessage({
        topic: TOPIC.RECORD,
        action: RECORD_ACTIONS.HAS_RESPONSE,
        name: recordName,
        parsedData: !!record,
      })
    }

    function onError (event, errorMessage, recordName, socket) {
      socket.sendError(message, event)
    }

    recordRequest(
      message.name,
      this.config,
      this.services,
      socketWrapper,
      onComplete,
      onError,
      this,
      this.metaData,
    )
  }

/**
 * Sends the records data current data once loaded from the cache, and null otherwise
 */
  private snapshot (socketWrapper: SocketWrapper, message: RecordMessage): void {
    const onComplete = function (record, recordName, socket) {
      if (record) {
        sendRecord(recordName, record, socket)
      } else {
        socket.sendError(message, RECORD_ACTIONS.RECORD_NOT_FOUND)
      }
    }
    const onError = function (event, errorMessage, recordName, socket) {
      socket.sendError(message, event)
    }

    recordRequest(
      message.name,
      this.config,
      this.services,
      socketWrapper,
      onComplete,
      onError,
      this,
      this.metaData,
    )
  }

/**
 * Similar to snapshot, but will only return the current version number
 */
  private head (socketWrapper: SocketWrapper, message: RecordMessage): void {
    const onComplete = function (record, recordName, socket) {
      if (record) {
        socket.sendMessage({
          topic: TOPIC.RECORD,
          action: RECORD_ACTIONS.HEAD_RESPONSE,
          name: recordName,
          version: record._v,
        })
      } else {
        socket.sendError(message, RECORD_ACTIONS.RECORD_NOT_FOUND)
      }
    }
    const onError = function (event, errorMessage, recordName, socket) {
      socket.sendError(message, event)
    }

    recordRequest(
      message.name,
      this.config,
      this.services,
      socketWrapper,
      onComplete,
      onError,
      this,
      this.metaData,
    )
  }

/**
 * Tries to retrieve the record and creates it if it doesn't exist. Please
 * note that create also triggers a read once done
 */
  private createOrRead (socketWrapper: SocketWrapper, message: RecordMessage): void {
    const onComplete = function (record, recordName, socket) {
      if (record) {
        this.read(message, record, socket)
      } else {
        this.permissionAction(
          RECORD_ACTIONS.CREATE,
          recordName,
          socket,
          this.create.bind(this, message, socket),
        )
      }
    }

    recordRequest(
      message.name,
      this.config,
      this.services,
      socketWrapper,
      onComplete,
      () => {},
      this,
      this.metaData,
    )
  }

/**
 * An upsert operation where the record will be created and written to
 * with the data in the message. Important to note that each operation,
 * the create and the write are permissioned separately.
 *
 * This method also takes note of the storageHotPathPatterns option, when a record
 * with a name that matches one of the storageHotPathPatterns is written to with
 * the CREATEANDUPDATE action, it will be permissioned for both CREATE and UPDATE, then
 * inserted into the cache and storage.
 */
  private createAndUpdate (socketWrapper: SocketWrapper, message: RecordWriteMessage): void {
    const recordName = message.name
    const isPatch = message.path !== null
    message = Object.assign({}, message, { action: isPatch ? RECORD_ACTIONS.PATCH : RECORD_ACTIONS.UPDATE })

    // allow writes on the hot path to bypass the record transition
    // and be written directly to cache and storage
    for (let i = 0; i < this.config.storageHotPathPatterns.length; i++) {
      const pattern = this.config.storageHotPathPatterns[i]
      if (recordName.indexOf(pattern) !== -1 && !isPatch) {
        this.permissionAction(RECORD_ACTIONS.CREATE, recordName, socketWrapper, () => {
          this.permissionAction(RECORD_ACTIONS.UPDATE, recordName, socketWrapper, () => {
            this.forceWrite(recordName, message, socketWrapper)
          })
        })
        return
      } else if (isPatch) {
        socketWrapper.sendError(message, RECORD_ACTIONS.INVALID_PATCH_ON_HOTPATH)
        return
      }
    }

    const transition = this.transitions[recordName]
    if (transition) {
      this.permissionAction(message.action, recordName, socketWrapper, () => {
        transition.add(socketWrapper, message)
      })
      return
    }

    this.permissionAction(RECORD_ACTIONS.CREATE, recordName, socketWrapper, () => {
      this.permissionAction(RECORD_ACTIONS.UPDATE, recordName, socketWrapper, () => {
        this.update(socketWrapper, message, true)
      })
    })
  }

/**
 * Forcibly writes to the cache and storage layers without going via
 * the RecordTransition. Usually updates and patches will go via the
 * transition which handles write acknowledgements, however in the
 * case of a hot path write acknowledgement we need to handle that
 * case here.
 */
  private forceWrite (recordName: string, message: RecordWriteMessage, socketWrapper: SocketWrapper): void {
    socketWrapper.parseData(message)
    const record = { _v: 0, _d: message.parsedData }
    const writeAck = message.isWriteAck
    let cacheResponse = false
    let storageResponse = false
    let writeError
    this.services.storage.set(recordName, record, (error) => {
      if (writeAck) {
        storageResponse = true
        writeError = writeError || error || null
        this.handleForceWriteAcknowledgement(
          socketWrapper, message, cacheResponse, storageResponse, writeError,
        )
      }
    }, this.metaData)

    this.services.cache.set(recordName, record, (error) => {
      if (!error) {
        this.broadcastUpdate(recordName, message, false, socketWrapper)
      }
      if (writeAck) {
        cacheResponse = true
        writeError = writeError || error || null
        this.handleForceWriteAcknowledgement(
        socketWrapper, message, cacheResponse, storageResponse, writeError,
      )
      }
    }, this.metaData)
  }

/**
 * Handles write acknowledgements during a force write. Usually
 * this case is handled via the record transition.
 */
  public handleForceWriteAcknowledgement (
    socketWrapper: SocketWrapper, message: RecordWriteMessage, cacheResponse: boolean, storageResponse: boolean, error: Error,
  ): void {
    if (storageResponse && cacheResponse) {
      socketWrapper.sendMessage({
        topic: TOPIC.RECORD,
        action: RECORD_ACTIONS.WRITE_ACKNOWLEDGEMENT,
        name: message.name,
        data: [message.version, error],
      }, true)
    }
  }

/**
 * Creates a new, empty record and triggers a read operation once done
 */
  private create (message: RecordMessage, socketWrapper: SocketWrapper, callback: Function): void {
    const recordName = message.name
    const record = { _v: 0, _d: {} }

    // store the records data in the cache and wait for the result
    this.services.cache.set(recordName, record, (error) => {
      if (error) {
        this.services.logger.error(RECORD_ACTIONS[RECORD_ACTIONS.RECORD_CREATE_ERROR], recordName, this.metaData)
        socketWrapper.sendError(message, RECORD_ACTIONS.RECORD_CREATE_ERROR)
      } else if (callback) {
        callback(recordName, socketWrapper)
      } else {
        this.read(message, record, socketWrapper)
      }
    }, this.metaData)

    if (!this.config.storageExclusion || !this.config.storageExclusion.test(recordName)) {
    // store the record data in the persistant storage independently and don't wait for the result
      this.services.storage.set(recordName, record, (error) => {
        if (error) {
          this.services.logger.error(RECORD_ACTIONS[RECORD_ACTIONS.RECORD_CREATE_ERROR], `storage:${error}`, this.metaData)
        }
      }, this.metaData)
    }
  }

/**
 * Subscribes to updates for a record and sends its current data once done
 */
  private read (message: RecordMessage, record: StorageRecord, socketWrapper: SocketWrapper): void {
    this.permissionAction(RECORD_ACTIONS.READ, message.name, socketWrapper, () => {
      this.subscriptionRegistry.subscribe(message, socketWrapper)
      sendRecord(message.name, record, socketWrapper)
    })
  }

 /**
 * Applies both full and partial updates. Creates a new record transition that will live as
 * long as updates are in flight and new updates come in
 */
  private update (socketWrapper: SocketWrapper, message: RecordWriteMessage, upsert: boolean): void {
    const recordName = message.name
    const version = message.version

  /*
   * If the update message is received from the message bus, rather than from a client,
   * assume that the original deepstream node has already updated the record in cache and
   * storage and only broadcast the message to subscribers
   */
    if (socketWrapper.isRemote) {
      this.broadcastUpdate(recordName, message, false, socketWrapper)
      return
    }

    let transition = this.transitions[recordName]
    if (transition && transition.hasVersion(version)) {
      transition.sendVersionExists({ message, version, sender: socketWrapper })
      return
    }

    if (!transition) {
      transition = new RecordTransition(recordName, this.config, this.services, this, this.metaData)
      this.transitions[recordName] = transition
    }

    transition.add(socketWrapper, message, upsert)
  }

/**
 * Invoked by RecordTransition. Notifies local subscribers and other deepstream
 * instances of record updates
 */
  public broadcastUpdate (name: string, message: RecordMessage, noDelay: boolean, originalSender: SocketWrapper): void {
    this.subscriptionRegistry.sendToSubscribers(name, message, noDelay, originalSender)
  }

/**
 * Called by a RecordTransition, either if it is complete or if an error occured. Removes
 * the transition from the registry
 */
  public transitionComplete (recordName: string): void {
    delete this.transitions[recordName]
  }

/**
 * Executes or schedules a callback function once all transitions are complete
 *
 * This is called from the PermissionHandler destroy method, which
 * could occur in cases where 'runWhenRecordStable' is never called,
 * such as when no cross referencing or data loading is used.
 */
  public removeRecordRequest (recordName: string): void {
    if (!this.recordRequestsInProgress[recordName]) {
      return
    }

    if (this.recordRequestsInProgress[recordName].length === 0) {
      delete this.recordRequestsInProgress[recordName]
      return
    }

    const callback = this.recordRequestsInProgress[recordName].splice(0, 1)[0]
    callback(recordName)
  }

/**
 * Executes or schedules a callback function once all record requests are removed.
 * This is critical to block reads until writes have occured for a record, which is
 * only from permissions when a rule is required to be run and the cache has not
 * verified it has the latest version
 */
  public runWhenRecordStable (recordName: string, callback: Function): void {
    if (
    !this.recordRequestsInProgress[recordName] ||
    this.recordRequestsInProgress[recordName].length === 0
  ) {
      this.recordRequestsInProgress[recordName] = []
      callback(recordName)
    } else {
      this.recordRequestsInProgress[recordName].push(callback)
    }
  }

/**
 * Deletes a record. If a transition is in progress it will be stopped. Once the deletion is
 * complete, an ACK is returned to the sender and broadcast to the message bus.
 */
  private delete (socketWrapper: SocketWrapper, message: RecordMessage) {
    const recordName = message.name

    if (this.transitions[recordName]) {
      this.transitions[recordName].destroy()
      delete this.transitions[recordName]
    }

    // tslint:disable-next-line
    new RecordDeletion(this.config, this.services, socketWrapper, message, this.onDeleted.bind(this), this.metaData)
  }

/**
 * Handle a record deletion ACK from the message bus. We assume that the original deepstream node
 * has already deleted the record from cache and storage and we only need to broadcast the message
 * to subscribers.
 *
 * If a transition is in progress it will be stopped.
 */
  private deleteAck (socketWrapper: SocketWrapper, message: RecordMessage) {
    const recordName = message.name

    if (this.transitions[recordName]) {
      this.transitions[recordName].destroy()
      delete this.transitions[recordName]
    }

    this.onDeleted(recordName, message, socketWrapper)
  }

/*
 * Callback for completed deletions. Notifies subscribers of the delete and unsubscribes them
 */
  private onDeleted (name: string, message: RecordMessage, originalSender: SocketWrapper) {
    this.broadcastUpdate(name, message, true, originalSender)

    for (const subscriber of this.subscriptionRegistry.getLocalSubscribers(name)) {
      this.subscriptionRegistry.unsubscribe(message, subscriber, true)
    }
  }

/**
 * A secondary permissioning step that is performed once we know if the record exists (READ)
 * or if it should be created (CREATE)
 */
  private permissionAction (action: RECORD_ACTIONS, recordName: string, socketWrapper: SocketWrapper, successCallback: Function) {
    const message = {
      topic: TOPIC.RECORD,
      action,
      name: recordName,
    }

    this.services.permissionHandler.canPerformAction(
      socketWrapper.user,
      message,
      onPermissionResponse.bind(this, socketWrapper, message, successCallback),
      socketWrapper.authData,
      socketWrapper,
    )
  }

}

/*
 * Callback for complete permissions. Notifies socket if permission has failed
 */
function onPermissionResponse (
  socketWrapper: SocketWrapper, message: RecordMessage, successCallback: Function, error: Error, canPerformAction: boolean,
): void {
  if (error !== null) {
    this.services.logger.error(RECORD_ACTIONS[RECORD_ACTIONS.MESSAGE_PERMISSION_ERROR], error.toString())
    socketWrapper.sendError(message, RECORD_ACTIONS.MESSAGE_PERMISSION_ERROR)
  } else if (canPerformAction !== true) {
    socketWrapper.sendError(message, RECORD_ACTIONS.MESSAGE_DENIED)
  } else {
    successCallback()
  }
}

  /**
 * Sends the records data current data once done
 */
function sendRecord (recordName: string, record: StorageRecord, socketWrapper: SocketWrapper) {
  socketWrapper.sendMessage({
    topic: TOPIC.RECORD,
    action: RECORD_ACTIONS.READ_RESPONSE,
    name: recordName,
    version: record._v,
    parsedData: record._d,
  })
}

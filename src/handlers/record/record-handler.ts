import RecordDeletion from './record-deletion'
import { recordRequestBinding } from './record-request'
import { RecordTransition } from './record-transition'
import { SubscriptionRegistry, Handler, DeepstreamConfig, DeepstreamServices, SocketWrapper, EVENT } from '@deepstream/types'
import { ListenerRegistry } from '../../listen/listener-registry'
import { isExcluded } from '../../utils/utils'
import { STATE_REGISTRY_TOPIC, RecordMessage, TOPIC, RecordWriteMessage, BulkSubscriptionMessage, ListenMessage, PARSER_ACTION, RECORD_ACTION as RA, JSONObject, Message, RECORD_ACTION, ALL_ACTIONS } from '../../constants'

export default class RecordHandler extends Handler<RecordMessage> {
  private subscriptionRegistry: SubscriptionRegistry
  private listenerRegistry: ListenerRegistry
  private transitions = new Map<string, RecordTransition>()
  private recordRequestsInProgress = new Map<string, Function[]>()
  private recordRequest: Function

/**
 * The entry point for record related operations
 */
  constructor (private readonly config: DeepstreamConfig, private readonly services: DeepstreamServices, subscriptionRegistry?: SubscriptionRegistry, listenerRegistry?: ListenerRegistry, private readonly metaData?: any) {
    super()

    this.subscriptionRegistry =
      subscriptionRegistry || services.subscriptions.getSubscriptionRegistry(TOPIC.RECORD, STATE_REGISTRY_TOPIC.RECORD_SUBSCRIPTIONS)
    this.listenerRegistry =
      listenerRegistry || new ListenerRegistry(TOPIC.RECORD, config, services, this.subscriptionRegistry, null)
    this.subscriptionRegistry.setSubscriptionListener(this.listenerRegistry)
    this.recordRequest = recordRequestBinding(config, services, this, metaData)

    this.onDeleted = this.onDeleted.bind(this)
    this.create = this.create.bind(this)
    this.onPermissionResponse = this.onPermissionResponse.bind(this)
  }

  public async close () {
    this.listenerRegistry.close()
  }

  /**
 * Handles incoming record requests.
 *
 * Please note that neither CREATE nor READ is supported as a
 * client send action. Instead the client sends CREATEORREAD
 * and deepstream works which one it will be
 */
  public handle (socketWrapper: SocketWrapper | null, message: RecordMessage): void {
    const action = message.action

    if (socketWrapper === null) {
      this.handleClusterUpdate(message)
      return
    }

    if (action === RA.SUBSCRIBE) {
      this.subscriptionRegistry.subscribeBulk(message as BulkSubscriptionMessage, socketWrapper)
      return
    }

    if (action === RA.SUBSCRIBECREATEANDREAD || action === RA.SUBSCRIBEANDREAD) {
      const onSuccess = action === RA.SUBSCRIBECREATEANDREAD ? this.onSubscribeCreateAndRead : this.onSubscribeAndRead
      const l = message.names!.length
      for (let i = 0; i < l; i++) {
        this.recordRequest(
          message.names![i],
          socketWrapper,
          onSuccess,
          onRequestError,
          { ...message, name: message.names![i] }
        )
      }
      socketWrapper.sendAckMessage(message)
      return
    }

    if (
      action === RA.CREATEANDUPDATE ||
      action === RA.CREATEANDPATCH
    ) {
    /*
     * Allows updates to the record without being subscribed, creates
     * the record if it doesn't exist
     */
      this.createAndUpdate(socketWrapper!, message as RecordWriteMessage)
      return
    }

    if (action === RA.READ) {
    /*
     * Return the current state of the record in cache or db
     */
      this.recordRequest(message.name, socketWrapper, onSnapshotComplete, onRequestError, message)
      return
    }

    if (action === RA.HEAD) {
    /*
     * Return the current version of the record or -1 if not found
     */
      this.head(socketWrapper!, message)
      return
    }

    if (action === RA.SUBSCRIBEANDHEAD) {
    /*
     * Return the current version of the record or -1 if not found, subscribing either way
     */
      this.subscribeAndHeadBulk(socketWrapper!, message)
      return
    }

    if (action === RA.UPDATE || action === RA.PATCH || action === RA.ERASE) {
    /*
     * Handle complete (UPDATE) or partial (PATCH/ERASE) updates
     */
      this.update(socketWrapper, message as RecordWriteMessage, message.isWriteAck || false)
      return
    }

    if (action === RA.DELETE) {
    /*
     * Deletes the record
     */
      this.delete(socketWrapper!, message)
      return
    }

    if (action === RA.UNSUBSCRIBE) {
    /*
    * Unsubscribes (discards) a record that was previously subscribed to
    * using read()
    */
      this.subscriptionRegistry.unsubscribeBulk(message as BulkSubscriptionMessage, socketWrapper!)
      return
    }

    if (action === RA.LISTEN || action === RA.UNLISTEN || action === RA.LISTEN_ACCEPT || action === RA.LISTEN_REJECT) {
        /*
    * Listen to requests for a particular record or records
    * whose names match a pattern
    */
      this.listenerRegistry.handle(socketWrapper!, message as ListenMessage)
      return
    }

    if (message.action === RA.NOTIFY) {
      this.recordUpdatedWithoutDeepstream(message, socketWrapper)
      return
    }

    this.services.logger.error(PARSER_ACTION[PARSER_ACTION.UNKNOWN_ACTION], RA[action], this.metaData)
  }

  private handleClusterUpdate (message: RecordMessage) {
    if (message.action === RA.DELETED) {
      this.remoteDelete(message)
      return
    }

    if (message.action === RA.NOTIFY) {
      this.recordUpdatedWithoutDeepstream(message)
      return
    }

    this.broadcastUpdate(message.name, {
      topic: message.topic,
      action: message.action,
      name: message.name,
      path: message.path,
      version: message.version,
      data: message.data,
      parsedData: message.parsedData
    }, false, null)
  }

  private async recordUpdatedWithoutDeepstream (message: RecordMessage, socketWrapper: SocketWrapper | null = null) {
    if (socketWrapper) {
      if (this.services.cache.deleteBulk === undefined) {
        const errorMessage = 'Cache needs to implement deleteBulk in order for it to work correctly'
        this.services.logger.error(EVENT.PLUGIN_ERROR, errorMessage)
        socketWrapper.sendMessage({
          topic: TOPIC.RECORD,
          action: RECORD_ACTION.RECORD_NOTIFY_ERROR,
          isError: true,
          parsedData: errorMessage,
          correlationId: message.correlationId
        })
        return
      }

      try {
        await new Promise<void>((resolve, reject) => this.services.cache.deleteBulk(message.names!, (error) => {
          error ? reject(error) : resolve()
        }))
      } catch (error) {
        const errorMessage = 'Error deleting messages in bulk when attempting to notify of remote changes'
        this.services.logger.error(EVENT.ERROR, `${errorMessage}: ${error.toString()}`, { message })
        socketWrapper.sendMessage({
          topic: TOPIC.RECORD,
          action: RECORD_ACTION.RECORD_NOTIFY_ERROR,
          isError: true,
          parsedData: errorMessage,
          correlationId: message.correlationId
        })
        return
      }
    }

    let completed = 0
    message.names!.forEach((recordName, index, names) => {
      if (this.subscriptionRegistry.hasLocalSubscribers(recordName)) {
        this.recordRequest(recordName, socketWrapper, (name: string, version: number, data: JSONObject) => {
          if (version === -1) {
            this.remoteDelete({
              topic: TOPIC.RECORD,
              action: RECORD_ACTION.DELETED,
              name
            })
          } else {
            this.subscriptionRegistry.sendToSubscribers(name, {
              topic: TOPIC.RECORD,
              action: RECORD_ACTION.UPDATE,
              name,
              version,
              parsedData: data
            }, true, null)
          }

          completed++
          if (completed === names.length && socketWrapper) {
            socketWrapper.sendAckMessage(message)
            this.services.clusterNode.send(message)
          }
        }, (event: RA, errorMessage: string, name: string, socket: SocketWrapper, msg: Message) => {
          completed++
          if (socket) {
            onRequestError(event, errorMessage, recordName, socket, msg)
          }
          if (completed === names.length && socket) {
            socket.sendAckMessage(message)
            this.services.clusterNode.send(message)
          }
        }, message)
      } else {
        completed++
        if (completed === names.length && socketWrapper) {
          socketWrapper.sendAckMessage(message)
          this.services.clusterNode.send(message)
        }
      }
    })
  }

  /**
   * Returns just the current version number of a record
   * Results in a HEAD_RESPONSE
   * If the record is not found, the version number will be -1
   */
  private head (socketWrapper: SocketWrapper, message: RecordMessage, name: string = message.name): void {
    this.recordRequest(name, socketWrapper, onHeadComplete, onRequestError, message)
  }

  private subscribeAndHeadBulk (socketWrapper: SocketWrapper, message: RecordMessage): void {
    this.services.cache.headBulk(message.names!, (error, versions, missing) => {
      if (error) {
        this.services.logger.error(EVENT.ERROR, `Error subscribing and head bulk for ${message.correlationId}`)
        return
      }

      if (Object.keys(versions!).length > -1) {
        socketWrapper.sendMessage({
          topic: TOPIC.RECORD,
          action: RA.HEAD_RESPONSE_BULK,
          versions
        })
      }

      this.subscriptionRegistry.subscribeBulk(message as BulkSubscriptionMessage, socketWrapper)

      const l = missing!.length
      for (let i = 0; i < l; i++) {
        if (versions![missing![i]] === undefined) {

          this.head(socketWrapper, message, missing![i])
        }
      }
    })
  }

  private onSubscribeCreateAndRead (recordName: string, version: number, data: JSONObject | null, socketWrapper: SocketWrapper, message: RecordMessage) {
    if (data) {
      this.readAndSubscribe(message, version, data, socketWrapper)
    } else {
      this.permissionAction(
        RA.CREATE,
        message,
        message.action,
        socketWrapper,
        this.create,
      )
    }
  }

  private onSubscribeAndRead (recordName: string, version: number, data: JSONObject | null, socketWrapper: SocketWrapper, message: RecordMessage) {
    if (data) {
      this.readAndSubscribe(message, version, data, socketWrapper)
    } else {
      this.permissionAction(RA.READ, message, message.action, socketWrapper, () => {
        this.subscriptionRegistry.subscribe(message.name, { ...message, action: RA.SUBSCRIBE }, socketWrapper, message.names !== undefined)
        socketWrapper.sendMessage({
          topic: TOPIC.RECORD,
          action: RECORD_ACTION.READ_RESPONSE,
          name: message.name,
          version: -1,
          parsedData: {},
        })
      })
    }
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
    const isPatch = message.path !== undefined
    const originalAction = message.action
    message = { ...message, action: isPatch ? RA.PATCH : RA.UPDATE }

    // allow writes on the hot path to bypass the record transition
    // and be written directly to cache and storage
    for (let i = 0; i < this.config.record.storageHotPathPrefixes.length; i++) {
      const pattern = this.config.record.storageHotPathPrefixes[i]
      if (recordName.indexOf(pattern) === 0) {
        if (isPatch) {
          const errorMessage = {
            topic: TOPIC.RECORD,
            action: RA.INVALID_PATCH_ON_HOTPATH,
            originalAction,
            name: recordName
          } as RecordMessage
          if (message.correlationId) {
            errorMessage.correlationId = message.correlationId
          }
          socketWrapper.sendMessage(errorMessage)
          return
        }

        this.permissionAction(RA.CREATE, message, originalAction, socketWrapper, () => {
          this.permissionAction(RA.UPDATE, message, originalAction, socketWrapper, () => {
            this.forceWrite(recordName, message, socketWrapper)
          })
        })
        return
      }
    }

    const transition = this.transitions.get(recordName)
    if (transition) {
      this.permissionAction(message.action, message, originalAction, socketWrapper, () => {
        transition.add(socketWrapper, message)
      })
      return
    }

    this.permissionAction(RA.CREATE, message, originalAction, socketWrapper, () => {
      this.permissionAction(RA.UPDATE, message, originalAction, socketWrapper, () => {
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
    const writeAck = message.isWriteAck
    let cacheResponse = false
    let storageResponse = false
    let writeError: string | null
    this.services.storage.set(recordName, 0, message.parsedData, (error) => {
      if (writeAck) {
        storageResponse = true
        writeError = writeError || error || null
        this.handleForceWriteAcknowledgement(
          socketWrapper, message, cacheResponse, storageResponse, writeError,
        )
      }
    }, this.metaData)

    this.services.cache.set(recordName, 0, message.parsedData, (error) => {
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
    socketWrapper: SocketWrapper, message: RecordWriteMessage, cacheResponse: boolean, storageResponse: boolean, error: Error | string | null,
  ): void {
    if (storageResponse && cacheResponse) {
      socketWrapper.sendMessage({
        topic: TOPIC.RECORD,
        action: RA.WRITE_ACKNOWLEDGEMENT,
        name: message.name,
        correlationId: message.correlationId
      }, true)
    }
  }

  /**
   * Creates a new, empty record and triggers a read operation once done
   */
  private create (socketWrapper: SocketWrapper, message: RecordMessage, originalAction: RECORD_ACTION): void {
    const recordName = message.name

    // store the records data in the cache and wait for the result
    this.services.cache.set(recordName, 0, {}, (error) => {
      if (error) {
        this.services.logger.error(RA[RA.RECORD_CREATE_ERROR], recordName, this.metaData)
        socketWrapper.sendMessage({
          topic: TOPIC.RECORD,
          action: RA.RECORD_CREATE_ERROR,
          originalAction,
          name: message.name
        })
        return
      }

      // this isn't really needed, can subscribe and send empty data immediately
      this.readAndSubscribe({ ...message, action: originalAction }, 0, {}, socketWrapper)
    }, this.metaData)

    if (!isExcluded(this.config.record.storageExclusionPrefixes, message.name)) {
      // store the record data in the persistant storage independently and don't wait for the result
      this.services.storage.set(recordName, 0, {}, (error) => {
        if (error) {
          this.services.logger.error(RA[RA.RECORD_CREATE_ERROR], `storage:${error}`, this.metaData)
        }
      }, this.metaData)
    }
  }

/**
 * Subscribes to updates for a record and sends its current data once done
 */
  private readAndSubscribe (message: RecordMessage, version: number, data: any, socketWrapper: SocketWrapper): void {
    this.permissionAction(RA.READ, message, message.action, socketWrapper, () => {
      this.subscriptionRegistry.subscribe(message.name, { ...message, action: RA.SUBSCRIBE }, socketWrapper, message.names !== undefined)

      this.recordRequest(message.name, socketWrapper, (_: string, newVersion: number, latestData: any) => {
        if (latestData) {
          if (newVersion !== version) {
            this.services.logger.info(
              EVENT.INFO, `BUG CAUGHT! ${message.name} was version ${version} for readAndSubscribe, ` +
              `but updated during permission to ${message.version}`
            )
          }
          sendRecord(message.name, version, latestData, socketWrapper)
        } else {
          this.services.logger.error(
            EVENT.ERROR,
            `BUG? ${message.name} was version ${version} for readAndSubscribe, ` +
            'but was removed during permission check',
            { message }
          )
          onRequestError(
            message.action, `"${message.name}" was removed during permission check`,
            message.name, socketWrapper, message
          )
        }
      }, onRequestError, message)
    })
  }

 /**
 * Applies both full and partial updates. Creates a new record transition that will live as
 * long as updates are in flight and new updates come in
 */
  private update (socketWrapper: SocketWrapper | null, message: RecordWriteMessage, upsert: boolean): void {
    const recordName = message.name
    const version = message.version

    /*
    * If the update message is received from the message bus, rather than from a client,
    * assume that the original deepstream node has already updated the record in cache and
    * storage and only broadcast the message to subscribers
    */
    if (socketWrapper === null) {
      this.broadcastUpdate(recordName, message, false, socketWrapper)
      return
    }

    const isPatch = message.path !== undefined
    message = { ...message, action: isPatch ? RA.PATCH : RA.UPDATE }

    let transition = this.transitions.get(recordName)
    if (transition && transition.hasVersion(version)) {
      transition.sendVersionExists({ message, sender: socketWrapper })
      return
    }

    if (!transition) {
      transition = new RecordTransition(recordName, this.config, this.services, this, this.metaData)
      this.transitions.set(recordName, transition)
    }
    transition.add(socketWrapper, message, upsert)
  }

/**
 * Invoked by RecordTransition. Notifies local subscribers and other deepstream
 * instances of record updates
 */
  public broadcastUpdate (name: string, message: RecordMessage, noDelay: boolean, originalSender: SocketWrapper | null): void {
      this.subscriptionRegistry.sendToSubscribers(name, message, noDelay, originalSender)
  }

/**
 * Called by a RecordTransition, either if it is complete or if an error occured. Removes
 * the transition from the registry
 */
  public transitionComplete (recordName: string): void {
    this.transitions.delete(recordName)
  }

/**
 * Executes or schedules a callback function once all transitions are complete
 *
 * This is called from the PermissionHandler destroy method, which
 * could occur in cases where 'runWhenRecordStable' is never called,
 * such as when no cross referencing or data loading is used.
 */
  public removeRecordRequest (recordName: string): void {
    const recordRequests = this.recordRequestsInProgress.get(recordName)

    if (!recordRequests) {
      return
    }

    if (recordRequests.length === 0) {
      this.recordRequestsInProgress.delete(recordName)
      return
    }

    const callback = recordRequests.splice(0, 1)[0]
    callback(recordName)
  }

/**
 * Executes or schedules a callback function once all record requests are removed.
 * This is critical to block reads until writes have occured for a record, which is
 * only from permissions when a rule is required to be run and the cache has not
 * verified it has the latest version
 */
  public runWhenRecordStable (recordName: string, callback: Function): void {
    const recordRequests = this.recordRequestsInProgress.get(recordName)
    if (!recordRequests || recordRequests.length === 0) {
      this.recordRequestsInProgress.set(recordName, [])
      callback(recordName)
    } else {
      recordRequests.push(callback)
    }
  }

/**
 * Deletes a record. If a transition is in progress it will be stopped. Once the deletion is
 * complete, an ACK is returned to the sender and broadcast to the message bus.
 */
  private delete (socketWrapper: SocketWrapper, message: RecordMessage) {
    const recordName = message.name

    const transition = this.transitions.get(recordName)
    if (transition) {
      transition.destroy()
      this.transitions.delete(recordName)
    }

    // tslint:disable-next-line
    new RecordDeletion(this.config, this.services, socketWrapper, message, this.onDeleted, this.metaData)
  }

/**
 * Handle a remote record deletion from the message bus. We assume that the original deepstream node
 * has already deleted the record from cache and storage and we only need to broadcast the message
 * to subscribers.
 *
 * If a transition is in progress it will be stopped.
 */
  private remoteDelete (message: RecordMessage) {
    const recordName = message.name

    const transition = this.transitions.get(recordName)
    if (transition) {
      transition.destroy()
      this.transitions.delete(recordName)
    }

    this.onDeleted(recordName, message, null)
  }

/*
 * Callback for completed deletions. Notifies subscribers of the delete and unsubscribes them
 */
  private onDeleted (name: string, message: RecordMessage, originalSender: SocketWrapper | null) {
    this.broadcastUpdate(name, message, true, originalSender)

    for (const subscriber of this.subscriptionRegistry.getLocalSubscribers(name)) {
      this.subscriptionRegistry.unsubscribe(name, message, subscriber, true)
    }
  }

/**
 * A secondary permissioning step that is performed once we know if the record exists (READ)
 * or if it should be created (CREATE)
 */
  private permissionAction (actionToPermission: RA, message: Message, originalAction: RA, socketWrapper: SocketWrapper, successCallback: Function) {
    const copyWithAction = {...message, action: actionToPermission }
    this.services.permission.canPerformAction(
      socketWrapper,
      copyWithAction,
      this.onPermissionResponse,
      { originalAction, successCallback }
    )
  }

  /*
  * Callback for complete permissions. Important to note that only compound operations like
  * CREATE_AND_UPDATE will end up here.
  */
  private onPermissionResponse (
    socketWrapper: SocketWrapper, message: Message, { originalAction, successCallback }: { originalAction: RA, successCallback: Function }, error: string | Error | ALL_ACTIONS | null, canPerformAction: boolean,
  ): void {
    if (error || !canPerformAction) {
      let action
      if (error) {
        this.services.logger.error(RA[RA.MESSAGE_PERMISSION_ERROR], error.toString())
        action = RA.MESSAGE_PERMISSION_ERROR
      } else {
        action = RA.MESSAGE_DENIED
      }
      const msg = {
        topic: TOPIC.RECORD,
        action,
        originalAction,
        name: message.name,
        isError: true
      } as RecordMessage
      if (message.correlationId) {
        msg.correlationId = message.correlationId
      }
      if (message.isWriteAck) {
        msg.isWriteAck = true
      }
      socketWrapper.sendMessage(msg)
    } else {
      successCallback(socketWrapper, message, originalAction)
    }
  }
}

function onRequestError (event: RA, errorMessage: string, recordName: string, socket: SocketWrapper, message: Message) {
  const msg = {
    topic: TOPIC.RECORD,
    action: event,
    originalAction: message.action,
    name: recordName,
    isError: true,
  } as Message
  if (message.isWriteAck) {
    msg.isWriteAck = true
  }
  socket.sendMessage(msg)
}

function onSnapshotComplete (recordName: string, version: number, data: JSONObject, socket: SocketWrapper, message: Message) {
  if (data) {
    sendRecord(recordName, version, data, socket)
  } else {
    socket.sendMessage({
      topic: TOPIC.RECORD,
      action: RA.RECORD_NOT_FOUND,
      originalAction: message.action,
      name: message.name,
      isError: true
    })
  }
}

function onHeadComplete (name: string, version: number, data: never, socketWrapper: SocketWrapper) {
  socketWrapper.sendMessage({
    topic: TOPIC.RECORD,
    action: RA.HEAD_RESPONSE,
    name,
    version
  })
}

/**
* Sends the records data current data once done
*/
function sendRecord (recordName: string, version: number, data: any, socketWrapper: SocketWrapper) {
  socketWrapper.sendMessage({
    topic: TOPIC.RECORD,
    action: RA.READ_RESPONSE,
    name: recordName,
    version,
    parsedData: data,
  })
}

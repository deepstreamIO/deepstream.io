import {EventEmitter} from 'events'
import Timeout = NodeJS.Timeout
import { DeepstreamPlugin, DeepstreamLockRegistry, DeepstreamServices, DeepstreamConfig, LockCallback, EVENT } from '@deepstream/types'
import { TOPIC, LOCK_ACTION, LockMessage } from '../../constants'

/**
 * The lock registry is responsible for maintaing a single source of truth
 * within the cluster, used mainly for issuing cluster wide locks when an operation
 * that stretches over multiple nodes are required.
 *
 * For example, distributed listening requires a leader to drive the nodes in sequence,
 * so issuing a lock prevents multiple nodes from assuming the lead.
 *
 */
export class DistributedLockRegistry extends DeepstreamPlugin implements DeepstreamLockRegistry {
  public description: string = 'Distributed Lock Registry'
  private locks = new Set<string>()
  private timeouts = new Map<string, Timeout>()
  private responseEventEmitter = new EventEmitter()

  /**
   * The unique registry is a singleton and is only created once
   * within deepstream.io. It is passed via
   * via the options object.
   */
  constructor (private pluginOptions: any, private services: Readonly<DeepstreamServices>, private config: Readonly<DeepstreamConfig>) {
    super()
    this.onPrivateMessage =  this.onPrivateMessage.bind(this)
  }

  public init () {
    this.services.clusterNode.subscribe(TOPIC.LOCK, this.onPrivateMessage)
  }

  /**
   * Requests a lock, if the leader ( whether local or distributed ) has the lock availble
   * it will invoke the callback with true, otherwise false.
   */
  public get (lockName: string, callback: LockCallback) {
    if (this.services.clusterRegistry.isLeader()) {
      callback(this.getLock(lockName))
    } else if (!this.timeouts.has(lockName)) {
       this.getRemoteLock(lockName, callback)
    } else {
      callback(false)
    }
  }

  /**
   * Release a lock, allowing other resources to request it again
   */
  public release (lockName: string) {
    if (this.services.clusterRegistry.isLeader()) {
       this.releaseLock(lockName)
    } else {
       this.releaseRemoteLock(lockName)
    }
  }

  /**
   * Called when the current node is not the leader, issuing a lock request
   * via the message bus
   */
  private getRemoteLock (lockName: string, callback: LockCallback) {
    const leaderServerName = this.services.clusterRegistry.getLeader()

    this.timeouts.set(lockName, setTimeout(
      this.onLockRequestTimeout.bind(this, lockName),
      this.pluginOptions.requestTimeout
    ))

    this.responseEventEmitter.once(lockName, callback)

    this.services.clusterNode.sendDirect(leaderServerName, {
      topic: TOPIC.LOCK,
      action: LOCK_ACTION.REQUEST,
      name: lockName
    })
  }

  /**
   * Notifies a remote leader keeping a lock that said lock is no longer required
   */
  private releaseRemoteLock (lockName: string) {
    const leaderServerName = this.services.clusterRegistry.getLeader()
    this.services.clusterNode.sendDirect(leaderServerName, {
      topic:  TOPIC.LOCK,
      action: LOCK_ACTION.RELEASE,
      name: lockName
    })
  }

  /**
   * Called when a message is received on the message bus.
   * This could mean the leader responded to a request or that you're currently
   * the leader and received a request.
   */
  private onPrivateMessage (message: LockMessage, remoteServerName: string) {
    if (message.action === LOCK_ACTION.RESPONSE) {
        this.handleRemoteLockResponse(message.name!, message.locked)
        return
    }

    if (this.services.clusterRegistry.isLeader() === false) {
      this.services.logger.warn(
          EVENT.INVALID_LEADER_REQUEST,
          `server ${remoteServerName} assumes this node '${this.config.serverName}' is the leader`
      )
      return
    }

    if (message.action === LOCK_ACTION.REQUEST) {
      this.handleRemoteLockRequest(message.name, remoteServerName)
      return
    }

    if (message.action === LOCK_ACTION.RELEASE) {
       this.releaseLock(message.name!)
       return
    }
  }

  /**
   * Called when a remote lock request is received
   */
  private handleRemoteLockRequest (lockName: string, remoteServerName: string) {
    this.services.clusterNode.sendDirect(remoteServerName, {
      topic: TOPIC.LOCK,
      action: LOCK_ACTION.RESPONSE,
      name: lockName,
      locked: this.getLock(lockName)
    })
  }

  /**
   * Called when a remote lock response is received
   */
  private handleRemoteLockResponse (lockName: string, result: boolean) {
    clearTimeout(this.timeouts.get(lockName)!)
    this.timeouts.delete(lockName)
    this.responseEventEmitter.emit(lockName, result)
  }

  /**
   * Returns true if reserving lock was possible otherwise returns false
   */
  private getLock (lockName: string) {
    if (this.locks.has(lockName)) {
      return false
    }

    this.timeouts.set(lockName, setTimeout(
        this.onLockTimeout.bind(this, lockName),
        this.pluginOptions.holdTimeout
    ))
    this.locks.add(lockName)
    return true
  }

  /**
   * Called when a lock is no longer required and can be released. This is triggered either by
   * a timeout if a remote release message wasn't received in time or when release was called
   * locally.
   *
   * Important note: Anyone can release a lock. It is assumed that the cluster is trusted
   * so maintaining who has the lock is not required. This may need to change going forward.
   */
  private releaseLock (lockName: string) {
    clearTimeout(this.timeouts.get(lockName)!)
    this.timeouts.delete(lockName)
    this.locks.delete(lockName)
  }

  /**
   * Called when a timeout occurs on a lock that has been reserved for too long
   */
  private onLockTimeout (lockName: string) {
    this.releaseLock(lockName)
    this.services.logger.warn(EVENT.LOCK_RELEASE_TIMEOUT, `lock ${lockName} released due to timeout`, { lockName })
  }

  /**
   * Called when a remote request has timed out, resulting in notifying the client that
   * the lock wasn't able to be reserved
   */
  private onLockRequestTimeout (lockName: string) {
    this.handleRemoteLockResponse(lockName, false)
    this.services.logger.warn(EVENT.LOCK_REQUEST_TIMEOUT, `request for lock ${lockName} timed out`, { lockName })
  }
}

import { InternalDeepstreamConfig, DeepstreamServices } from "../types";

/**
 * The unique registry is responsible for maintaing a single source of truth
 * within the Server
 *
 */
export default class LockRegistry {
  private locks: any

  /**
  * The unique registry is a singleton and is only created once
  * within deepstream.io. It is passed via
  * via the options object.
  */
  constructor (config: InternalDeepstreamConfig, services: DeepstreamServices) {
    this.locks = {}
  }

  /**
  * Requests a lock, if the leader ( whether local or distributed ) has the lock availble
  * it will invoke the callback with true, otherwise false.
  */
  public get (name: string, callback: Function): void {
    callback(this.getLock(name))
  }

  /**
  * Release a lock, allowing other resources to request it again
  */
  public release (name: string): void {
    delete this.locks[name]
  }

  /**
  * Returns true if reserving lock was possible otherwise returns false
  */
  private getLock (name: string): boolean {
    if (this.locks[name] === true) {
      return false
    }
    this.locks[name] = true
    return true
  }
}

import { EOL } from 'os'
import { Message, RECORD_ACTION, PRESENCE_ACTION, EVENT_ACTION, RPC_ACTION, RecordData, TOPIC, RecordWriteMessage } from '../../../constants'
import { PermissionCallback, ValveConfig, SocketWrapper, DeepstreamConfig, DeepstreamServices, NamespacedLogger, EVENT } from '@deepstream/types'
import { recordRequest } from '../../../handlers/record/record-request'
import RecordHandler from '../../../handlers/record/record-handler'
import { setValue } from '../../../utils/json-path'

const OPEN = 'open'
const LOADING = 'loading'
const ERROR = 'error'

const UNDEFINED = 'undefined'
const STRING = 'string'

interface RuleApplicationParams {
   userId: string
   serverData: any
   path: string
   ruleSpecification: any
   message: Message
   action: RECORD_ACTION | PRESENCE_ACTION | EVENT_ACTION | RPC_ACTION
   regexp: RegExp
   rule: any
   name: string
   permissionOptions: ValveConfig
   logger: NamespacedLogger
   recordHandler: RecordHandler
   socketWrapper: SocketWrapper
   config: DeepstreamConfig
   services: DeepstreamServices,
   callback: PermissionCallback,
   passItOn: any,
}

export default class RuleApplication {
  private isDestroyed: boolean = false
  private runScheduled: boolean = false
  private pathVars: any
  private user: any

  private readonly maxIterationCount: number
  private readonly recordsData = new Map<string, RecordData | string>()

  private iterations: number

  /**
   * This class handles the evaluation of a single rule. It creates
   * the required variables, injects them into the rule function and
   * runs the function recoursively until either all cross-references,
   * references to old or new data is loaded, it errors or the maxIterationCount
   * limit is exceeded
   */
  constructor (private params: RuleApplicationParams) {
    this.maxIterationCount = this.params.permissionOptions.maxRuleIterations

    this.run = this.run.bind(this)
    this.crossReference = this.crossReference.bind(this)
    this.createNewRecordRequest = this.createNewRecordRequest.bind(this)

    this.pathVars = this.getPathVars()
    this.user = this.getUser()
    this.iterations = 0

    this.run()
  }

  /**
   * Runs the rule function. This method is initially called when this class
   * is constructed and recoursively from thereon whenever the loading of a record
   * is completed
   */
  private run (): void {
    this.runScheduled = false
    this.iterations++

    if (this.isDestroyed) {
      return
    }

    if (this.iterations > this.maxIterationCount) {
      this.onRuleError('Exceeded max iteration count')
      return
    }

    if (this.isDestroyed) {
      return
    }

    const args = this.getArguments()
    let result

    try {
      result = this.params.rule.fn.apply({}, args)
    } catch (error) {
      if (this.isReady()) {
        this.onRuleError(error)
        return
      }
    }

    if (this.isReady()) {
      this.params.callback(this.params.socketWrapper, this.params.message, this.params.passItOn, null, result)
      this.destroy()
    }
  }

  /**
   * Callback if a rule has irrecoverably errored. Rule errors due to unresolved
   * crossreferences are allowed as long as a loading step is in progress
   */
  private onRuleError (error: string): void {
    if (this.isDestroyed === true) {
      return
    }
    const errorMsg = `error when executing ${this.params.rule.fn.toString()}${EOL}for ${this.params.name}: ${error.toString()}`

    this.params.logger.warn(EVENT_ACTION[EVENT_ACTION.MESSAGE_PERMISSION_ERROR], errorMsg, { recordName: this.params.name })
    this.params.callback(this.params.socketWrapper, this.params.message, this.params.passItOn, EVENT_ACTION.MESSAGE_PERMISSION_ERROR, false)
    this.destroy()
  }

  /**
   * Called either asynchronously when data is successfully retrieved from the
   * cache or synchronously if its already present
   */
  private onLoadComplete (recordName: string, version: number, data: any): void {
    this.recordsData.set(recordName, data)

    if (this.isReady()) {
      this.runScheduled = true
      process.nextTick(this.run)
    }
  }

  /**
   * Called whenever a storage or cache retrieval fails. Any kind of error during the
   * permission process is treated as a denied permission
   */
  private onLoadError (event: any, errorMessage: string, recordName: string, socket: SocketWrapper | null) {
    this.recordsData.set(recordName, ERROR)
    const errorMsg = `failed to load record ${this.params.name} for permissioning:${errorMessage}`
    this.params.logger.error(RECORD_ACTION[RECORD_ACTION.RECORD_LOAD_ERROR], errorMsg, { recordName, socketWrapper: socket })
    this.params.callback(this.params.socketWrapper, this.params.message, this.params.passItOn, RECORD_ACTION.RECORD_LOAD_ERROR, false)
    this.destroy()
  }

  /**
   * Destroys this class and nulls down values to avoid
   * memory leaks
   */
  private destroy () {
    this.params.recordHandler.removeRecordRequest(this.params.name)
    this.isDestroyed = true
    this.runScheduled = false
    this.recordsData.clear()
    // this.params = null
    // this.crossReference = null
    // this.currentData = null
    this.pathVars = null
    this.user = null
  }

  /**
   * If data.someValue is used in the rule, this method retrieves or loads the
   * current data. This can mean different things, depending on the type of message
   *
   * the data arguments is supported for record read & write,
   * event publish and rpc request
   *
   * for event publish, record update and rpc request, the data is already provided
   * in the message and doesn't need to be loaded
   *
   * for record.patch, only a delta is part of the message. For the full data, the current value
   * is loaded and the patch applied on top
   */
  private getCurrentData (): any {
    if (this.params.rule.hasData === false) {
      return null
    }

    const msg = this.params.message
    let result: any = false

    if (
      (msg.topic === TOPIC.RPC) ||
      (msg.topic === TOPIC.EVENT && msg.data) ||
      (msg.topic === TOPIC.RECORD && msg.action === RECORD_ACTION.UPDATE)
    ) {
      result = this.params.socketWrapper.parseData(msg)
      if (result instanceof Error) {
        this.onRuleError(`error when converting message data ${result.toString()}`)
      } else {
        return msg.parsedData
      }
    } else if (msg.topic === TOPIC.RECORD && msg.action === RECORD_ACTION.PATCH) {
      result = this.getRecordPatchData(msg as RecordWriteMessage)
      if (result instanceof Error) {
        this.onRuleError(`error when converting message data ${result.toString()}`)
      } else {
        return result
      }
    }

  }

  /**
   * Loads the records current data and applies the patch data onto it
   * to avoid users having to distuinguish between patches and updates
   */
  private getRecordPatchData (msg: RecordWriteMessage): any {
    if (!this.recordsData) {
      return
    }

    if (!msg.path) {
      this.params.logger.error(EVENT.ERROR, `Missing path for record patch ${msg.name}`, { message: msg })
      return
    }

    const currentData = this.recordsData.get(this.params.name)
    const parseResult = this.params.socketWrapper.parseData(msg)
    let data

    if (parseResult instanceof Error) {
      return parseResult
    }

    if (currentData === null) {
      return new Error(`Tried to apply patch to non-existant record ${msg.name}`)
    }

    if (typeof currentData !== UNDEFINED && currentData !== LOADING) {
      data = JSON.parse(JSON.stringify(currentData))
      setValue(data, msg.path, msg.parsedData)
      return data
    }
    this.loadRecord(this.params.name)
  }

  /**
   * Returns or loads the record's previous value. Only supported for record
   * write and read operations
   *
   * If getData encounters an error, the rule application might already be destroyed
   * at this point
   */
  private getOldData (): any {
    if (this.isDestroyed === true || this.params.rule.hasOldData === false) {
      return
    }
    if (this.recordsData.has(this.params.name)) {
      return this.recordsData.get(this.params.name)
    }
    this.loadRecord(this.params.name)
  }

  /**
   * Compile the list of arguments that will be injected
   * into the permission function. This method is called
   * everytime the permission is run. This allows it to merge
   * patches and update the now timestamp
   */
  private getArguments (): any[] {
    return [
      this.crossReference,
      this.user,
      this.getCurrentData(),
      this.getOldData(),
      Date.now(),
      this.params ? this.params.action : null,
      this.params ? this.params.name : null
    ].concat(this.pathVars)
  }

  /**
   * Returns the data for the user variable. This is only done once
   * per rule as the user is not expected to change
   */
  private getUser (): any {
    return {
      isAuthenticated: this.params.userId !== OPEN,
      id: this.params.userId,
      data: this.params.serverData,
    }
  }

  /**
   * Applies the compiled regexp for the path and extracts
   * the variables that will be made available as $variableName
   * within the rule
   *
   * This is only done once per rule as the path is not expected
   * to change
   */
  private getPathVars (): string[] {
    if (!this.params.name) {
      return []
    }
    const matches = this.params.name.match(this.params.regexp)
    if (matches) {
      return matches.slice(1)
    } else {
      return []
    }
  }

  /**
   * Returns true if all loading operations that are in progress have finished
   * and no run has been scheduled yet
   */
  private isReady (): boolean {
    let isLoading = false

    // @ts-ignore
    for (const [key, value] of this.recordsData) {
      if (value === LOADING) {
        isLoading = true
        break
      }
    }

    return isLoading === false && this.runScheduled === false
  }

  /**
   * Loads a record with a given name. This will either result in
   * a onLoadComplete or onLoadError call. This method should only
   * be called if the record is not already being loaded or present,
   * but I'll leave the additional safeguards in until absolutely sure.
   */
  private loadRecord (recordName: string): void {
    const recordData = this.recordsData.get(recordName)

    if (recordData === LOADING) {
      return
    }

    if (typeof recordData !== UNDEFINED) {
      this.onLoadComplete(recordName, -1, recordData)
      return
    }

    this.recordsData.set(recordName, LOADING)

    this.params.recordHandler.runWhenRecordStable(
      recordName,
      this.createNewRecordRequest,
    )
  }

  /**
   * Load the record data from the cache for permissioning. This method should be
   * called once the record is stable – meaning there are no remaining writes
   * waiting to be written to the cache.
   */
  private createNewRecordRequest (recordName: string): void {
    recordRequest(
      recordName,
      this.params.config,
      this.params.services,
      null,
      this.onLoadComplete,
      this.onLoadError,
      this
    )
  }

  /**
   * This method is passed to the rule function as _ to allow crossReferencing
   * of other records. Cross-references can be nested, leading to this method
   * being recoursively called until the either all cross references are loaded
   * or the rule has finally failed
   */
  private crossReference (recordName: string): any | null {
    const type = typeof recordName
    const recordData = this.recordsData.get(recordName)

    if (type !== UNDEFINED && type !== STRING) {
      this.onRuleError(`crossreference got unsupported type ${type}`)
    } else if (type === UNDEFINED || recordName.indexOf(UNDEFINED) !== -1) {
      return
    } else if (recordData === LOADING) {
      return
    } else if (recordData === null) {
      return null
    } else if (typeof recordData === UNDEFINED) {
      this.loadRecord(recordName)
    } else {
      return recordData
    }
  }
}

import { EventEmitter } from 'events'
import * as pckg from '../package.json'
import PouchDB from 'pouchdb-node'
import { Subject, Observable } from 'rxjs'

const EMPTY_RECORD = { _d: {} }

export default class Connector extends EventEmitter {

  constructor (options) {
    super()
    this.isReady = false
    this.name = pckg.name
    this.version = pckg.version
    this._$set = new Subject()
    this._$get = new Subject()
    this._db = new PouchDB(options)

    const info$ = Observable
      .fromPromise(this._db.info())
      .do(() => {
        this.isReady = true
        this.emit('ready')
      })
      .share()

    const changes$ = info$
      .concatMap(info => this._changes(this._db, info.update_seq))
      .do(({ id, changes }) => {
        for (let n = 0; n < changes.length; ++n) {
          this.emit('change', id, changes[n].rev)
        }
      })

    const set$ = this._$set
      .map(({ recordName, record }) => toDoc(recordName, record))
      .bufferTime(100)
      .filter(xs => xs.length > 0)
      .mergeMap(async values => {
        await this._db
          .bulkDocs(values, { new_edits: false })
          .catch(err => {
            this.emit('error', 'failed to save to database: ' + err.message || err)
          })
      }, null, 32)
      .retryWhen(err$ => err$.do(err => this.emit('error', err.message || err)).delay(10000))

    const get$ = this._$get
      .bufferTime(100)
      .filter(xs => xs.length > 0)
      .mergeMap(async values => {
        const callbacks = {}

        for (let n = 0; n < values.length; ++n) {
          const { recordName, callback } = values[n]
          callbacks[recordName] = callbacks[recordName] || []
          callbacks[recordName].push(callback)
        }

        const keys = Object.keys(callbacks)
        const { rows } = await this._db
          .allDocs({
            keys,
            include_docs: true
          })
          .catch(err => {
            const rows = []
            for (let n = 0; n < keys.length; ++n) {
              rows[n] = { error: err.message || err }
            }
            return { rows }
          })

        for (let n = 0; n < rows.length; ++n) {
          const row = rows[n]

          let data
          let err = null
          if (row.error === 'not_found') {
            data = EMPTY_RECORD
          } else if (row.error) {
            err = row.error
          } else {
            data = fromDoc(row.doc)
          }

          for (let n = 0; n < callbacks[row.key].length; ++n) {
            callbacks[row.key][n](err, data)
          }
        }
      }, null, 32)
      .retryWhen(err$ => err$.do(err => this.emit('error', err.message || err)).delay(10000))

    Observable
      .merge(info$, changes$, get$, set$)
      .subscribe(null, err => this.emit('error', err))
  }

  set (recordName, record) {
    this._$set.next({ recordName, record })
  }

  get (recordName, callback) {
    this._$get.next({ recordName, callback })
  }

  _changes (db, since) {
    return Observable
      .create(o => {
        const changes = db
          .changes({
            since,
            live: true,
            batch_size: 256
          })
          .on('change', change => {
            since = change.seq
            o.next(change)
          })
          .on('error', err => o.error(err))
        return () => changes.cancel()
      })
      .retryWhen(err$ => err$.do(err => this.emit('error', err.message || err)).delay(10000))
  }
}

function toDoc (recordName, data) {
  const [ nextPosition, nextRevId ] = data._v.split('-')
  const [ , prevRevId ] = (data._p || '').split('-')
  return {
    ...(Object.keys(data._d).length > 0 ? data._d : { _deleted: true }),
    _id: recordName,
    _rev: data._v || undefined,
    _revisions: {
      ids: prevRevId ? [ nextRevId, prevRevId ] : [ nextRevId ],
      start: parseInt(nextPosition)
    }
  }
}

function fromDoc (doc) {
  const value = {
    _d: !doc || doc._deleted ? Object.create(null) : doc,
    _v: doc._rev
  }
  delete value._d._rev
  delete value._d._id
  return value
}

import * as C from '../../src/constants'

module.exports.deletionMsg = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.DELETE,
  name: 'someRecord'
}

module.exports.deletionSuccessMsg = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.DELETE_SUCCESS,
  name: 'someRecord'
}

module.exports.anotherDeletionMsg = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.DELETE,
  name: 'no-storage/1'
}

module.exports.anotherDeletionSuccessMsg = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.DELETE_SUCCESS,
  name: 'no-storage/1'
}

module.exports.subscribeCreateAndReadMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.SUBSCRIBECREATEANDREAD,
  name: 'some-record'
}

module.exports.readResponseMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.READ_RESPONSE,
  name: 'some-record',
  version: 0,
  parsedData: {}
}

module.exports.subscribeCreateAndReadPermissionErrorMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.MESSAGE_PERMISSION_ERROR,
  originalAction: C.RECORD_ACTIONS.SUBSCRIBECREATEANDREAD,
  name: 'some-record'
}

module.exports.subscribeCreateAndReadDeniedMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.MESSAGE_DENIED,
  originalAction: C.RECORD_ACTIONS.SUBSCRIBECREATEANDREAD,
  name: 'some-record'
}

module.exports.subscribeMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.SUBSCRIBE,
  name: 'some-record'
}

module.exports.unsubscribeMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.UNSUBSCRIBE,
  name: 'some-record'
}

module.exports.recordSnapshotMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.READ,
  name: 'some-record'
}

module.exports.recordHeadMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.HEAD,
  name: 'some-record'
}

module.exports.recordHeadResponseMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.HEAD_RESPONSE,
  name: 'some-record'
}

module.exports.recordData = { _v: 5, _d: { name: 'Kowalski' } }

module.exports.recordUpdate = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.UPDATE,
  name: 'some-record',
  version: module.exports.recordData._v + 1,
  parsedData: module.exports.recordData._d,
  isWriteAck: false
}

module.exports.recordUpdateWithAck = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.UPDATE,
  name: 'some-record',
  version: -1,
  parsedData: module.exports.recordData._d,
  isWriteAck: true
}

module.exports.recordPatch = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.PATCH,
  name: 'some-record',
  version: module.exports.recordData._v + 1,
  path: 'lastname',
  parsedData: 'Egon',
  isWriteAck: false
}

module.exports.recordPatchWithAck = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.PATCH,
  name: 'some-record',
  version: 4,
  path: 'lastname',
  parsedData: 'Egon',
  isWriteAck: true
}

module.exports.recordDelete = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.DELETE,
  name: 'some-record'
}

module.exports.createAndUpdate = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.CREATEANDUPDATE,
  name: 'some-record',
  version:  -1,
  parsedData: module.exports.recordData._d,
  isWriteAck: false
}

module.exports.listenAcceptMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.LISTEN_ACCEPT,
  name: 'record/.*',
  subscription: 'record/A'
}

module.exports.listenRejectMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.LISTEN_REJECT,
  name: 'record/.*',
  subscription: 'record/A'
}

module.exports.unlistenMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.UNLISTEN,
  name: 'record/.*'
}

module.exports.listenMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.LISTEN,
  name: 'record/.*'
}

module.exports.writeAck = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTIONS.WRITE_ACKNOWLEDGEMENT,
  name: 'some-record',
  data: [[-1], null]
}

import * as C from '../../constants'

export const deletionMsg = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.DELETE,
  name: 'someRecord'
}

export const deletionSuccessMsg = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.DELETE_SUCCESS,
  name: 'someRecord'
}

export const anotherDeletionMsg = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.DELETE,
  name: 'no-storage/1'
}

export const anotherDeletionSuccessMsg = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.DELETE_SUCCESS,
  name: 'no-storage/1'
}

export const subscribeCreateAndReadMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.SUBSCRIBECREATEANDREAD,
  names: ['some-record']
}

export const readResponseMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.READ_RESPONSE,
  name: 'some-record',
  version: 0,
  parsedData: {}
}

export const subscribeCreateAndReadPermissionErrorMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.MESSAGE_PERMISSION_ERROR,
  originalAction: C.RECORD_ACTION.SUBSCRIBECREATEANDREAD,
  names: ['some-record']
}

export const subscribeCreateAndReadDeniedMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.MESSAGE_DENIED,
  originalAction: C.RECORD_ACTION.SUBSCRIBECREATEANDREAD,
  names: ['some-record']
}

export const subscribeMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.SUBSCRIBE,
  names: ['some-record']
}

export const unsubscribeMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.UNSUBSCRIBE,
  names: ['some-record']
}

export const recordSnapshotMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.READ,
  name: 'some-record'
}

export const recordHeadMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.HEAD,
  name: 'some-record'
}

export const recordHeadResponseMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.HEAD_RESPONSE,
  name: 'some-record'
}

export const recordData = { name: 'Kowalski' }
export const recordVersion = 5

export const recordUpdate = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.UPDATE,
  name: 'some-record',
  version: recordVersion + 1,
  parsedData: recordData,
  isWriteAck: false
}

export const recordUpdateWithAck = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.UPDATE,
  name: 'some-record',
  version: -1,
  parsedData: recordData,
  isWriteAck: true
}

export const recordPatch = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.PATCH,
  name: 'some-record',
  version: recordVersion + 1,
  path: 'lastname',
  parsedData: 'Egon',
  isWriteAck: false
}

export const recordPatchWithAck = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.PATCH,
  name: 'some-record',
  version: 4,
  path: 'lastname',
  parsedData: 'Egon',
  isWriteAck: true
}

export const recordDelete = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.DELETE,
  name: 'some-record'
}

export const createAndUpdate = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.CREATEANDUPDATE,
  name: 'some-record',
  version:  -1,
  parsedData: recordData,
  isWriteAck: false
}

export const listenAcceptMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.LISTEN_ACCEPT,
  name: 'record/.*',
  subscription: 'record/A'
}

export const listenRejectMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.LISTEN_REJECT,
  name: 'record/.*',
  subscription: 'record/A'
}

export const unlistenMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.UNLISTEN,
  name: 'record/.*'
}

export const listenMessage = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.LISTEN,
  name: 'record/.*'
}

export const writeAck = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.WRITE_ACKNOWLEDGEMENT,
  name: 'some-record',
  data: [[-1], null]
}

export const notify = {
  topic: C.TOPIC.RECORD,
  action: C.RECORD_ACTION.NOTIFY,
  names: ['record1', 'record2']
}

const C = require('../../src/constants')

module.exports.deletionMsg = {
  topic: C.TOPIC.RECORD,
  action: C.ACTIONS.DELETE,
  name: 'someRecord'
}

module.exports.anotherDeletionMsg = {
  topic: C.TOPIC.RECORD,
  action: C.ACTIONS.DELETE,
  name: 'no-storage/1'
}

module.exports.createOrReadMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.CREATEORREAD,
    name: 'some-record'
  }

module.exports.readMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.READ,
    name: 'some-record',
    version: 0,
    parsedData: {}
  }

module.exports.readDeniedMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.READ,
    name: 'some-record'
  }

module.exports.createDeniedMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.CREATE,
    name: 'some-record'
  }


  module.exports.subscribeMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.SUBSCRIBE,
    name: 'some-record'
  }

  module.exports.unsubscribeMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.UNSUBSCRIBE,
    name: 'some-record'
  }

  module.exports.createOrReadMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.CREATEORREAD,
    name: 'some-record'
  }

  module.exports.readMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.READ,
    name: 'some-record',
    version: 0,
    parsedData: {}
  }

  module.exports.recordHasMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.HAS,
    name: 'some-record'
  }

  module.exports.recordSnapshotMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.SNAPSHOT,
    name: 'some-record'
  }

  module.exports.recordHeadMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.HEAD,
    name: 'some-record'
  }

  module.exports.recordData = { _v: 5, _d: { name: 'Kowalski' } }

  module.exports.recordUpdate = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.UPDATE,
    name: 'some-record',
    version: module.exports.recordData._v + 1,
    parsedData: module.exports.recordData._d,
    isWriteAck: false
  }

  module.exports.recordUpdateWithAck = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.UPDATE,
    name: 'some-record',
    version: -1,
    parsedData: module.exports.recordData._d,
    isWriteAck: true
  }

  module.exports.recordPatch = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.PATCH,
    name: 'some-record',
    version: module.exports.recordData._v + 1,
    path: 'lastname',
    parsedData: 'Egon',
    isWriteAck: false
  }

     module.exports.recordPatchWithAck = {
  topic: C.TOPIC.RECORD,
  action: C.ACTIONS.PATCH,
  name: 'some-record',
  version: 4,
  path: 'lastname',
  parsedData: 'Egon',
  isWriteAck: true
}


  module.exports.recordDelete = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.DELETE,
    name: 'some-record'
  }

  module.exports.createAndUpdate = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.CREATEANDUPDATE,
    name:'some-record',
    version:  -1,
    parsedData: module.exports.recordData._d,
    path: null,
    isWriteAck: false
  }

    module.exports.listenAcceptMessage = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.LISTEN_ACCEPT,
      name: 'record/.*',
      subscription: 'record/A'
    }

        module.exports.listenRejectMessage = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.LISTEN_REJECT,
      name: 'record/.*',
      subscription: 'record/A'
    }
        module.exports.unlistenMessage = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UNLISTEN,
      name: 'record/.*'
    }
            module.exports.listenMessage = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.LISTEN,
      name: 'record/.*'
    }

module.exports.writeAck = {
  topic: C.TOPIC.RECORD,
  action: C.ACTIONS.WRITE_ACKNOWLEDGEMENT,
  name: 'some-record',
  data: [[-1], null]
}

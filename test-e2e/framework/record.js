'use strict'

const sinon = require('sinon')
const assert = require('assert')
const clientHandler = require('./client-handler')
const utils = require('./utils')

function getRecordData (expression, recordName) {
  return clientHandler.getClients(expression).map(client => client.record.records[recordName])
}

function getListData (expression, listName) {
  return clientHandler.getClients(expression).map(client => client.record.lists[listName])
}

module.exports = {
  getRecord (clientExpression, recordName) {
    const clients = clientHandler.getClients(clientExpression)
    clients.forEach((client) => {
      const recordData = {
        record: client.client.record.getRecord(recordName),
        discardCallback: sinon.spy(),
        deleteCallback: sinon.spy(),
        callbackError: sinon.spy(),
        subscribeCallback: sinon.spy(),
        setCallback: undefined,
        subscribePathCallbacks: {}
      }
      recordData.record.on('discard', recordData.discardCallback)
      recordData.record.on('delete', recordData.deleteCallback)
      client.record.records[recordName] = recordData
    })
  },

  subscribe (clientExpression, recordName, immediate) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      recordData.record.subscribe(recordData.subscribeCallback, !!immediate)
    })
  },

  unsubscribe (clientExpression, recordName) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      recordData.record.unsubscribe(recordData.subscribeCallback)
    })
  },

  subscribeWithPath (clientExpression, recordName, path, immediate) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      recordData.subscribePathCallbacks[path] = sinon.spy()
      recordData.record.subscribe(path, recordData.subscribePathCallbacks[path], !!immediate)
    })
  },

  unsubscribeFromPath (clientExpression, recordName, path) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      recordData.record.unsubscribe(path, recordData.subscribePathCallbacks[path])
    })
  },

  discard (clientExpression, recordName) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      recordData.record.discard()
    })
  },

  delete (clientExpression, recordName) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      recordData.record.delete()
    })
  },

  setupWriteAck (clientExpression, recordName) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.record.records[recordName].setCallback = sinon.spy()
    })
  },

  set (clientExpression, recordName, data) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      if (recordData.setCallback) {
        recordData.record.set(utils.parseData(data), recordData.setCallback)
      } else {
        recordData.record.set(utils.parseData(data))
      }
    })
  },

  setWithPath (clientExpression, recordName, path, data) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      if (recordData.setCallback) {
        recordData.record.set(path, utils.parseData(data), recordData.setCallback)
      } else {
        recordData.record.set(path, utils.parseData(data))
      }
    })
  },

  setData (clientExpression, recordName, data) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.record.setData(recordName, utils.parseData(data))
    })
  },

  setDataWithWriteAck (clientExpression, recordName, data) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      if (!client.record.writeAcks) {
        client.record.writeAcks = {}
      }
      client.record.writeAcks[recordName] = sinon.spy()
      client.client.record.setData(recordName, utils.parseData(data), client.record.writeAcks[recordName])
    })
  },

  setDataWithPath (clientExpression, recordName, path, data) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.record.setData(recordName, path, utils.parseData(data))
    })
  },

  snapshot (clientExpression, recordName) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.record.snapshot(recordName, client.record.snapshotCallback)
    })
  },

  has (clientExpression, recordName) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.record.has(recordName, client.record.hasCallback)
    })
  },

  head (clientExpression, recordName) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.record.head(recordName, client.record.headCallback)
    })
  },

  /** ******************************************************************************************************************************
   *********************************************************** Lists ************************************************************
   ********************************************************************************************************************************/

   getList (clientExpression, listName) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const listData = {
        list: client.client.record.getList(listName),
        discardCallback: sinon.spy(),
        deleteCallback: sinon.spy(),
        callbackError: sinon.spy(),
        subscribeCallback: sinon.spy(),
        addedCallback: sinon.spy(),
        removedCallback: sinon.spy(),
        movedCallback: sinon.spy()
      }
      listData.list.on('discard', listData.discardCallback)
      listData.list.on('delete', listData.deleteCallback)
      listData.list.on('entry-added', listData.addedCallback)
      listData.list.on('entry-removed', listData.removedCallback)
      listData.list.on('entry-moved', listData.movedCallback)
      listData.list.subscribe(listData.subscribeCallback)
      client.record.lists[listName] = listData
    })
   },

   setEntries (clientExpression, listName, data) {
      const entries = utils.parseData(data)
      getListData(clientExpression, listName).forEach((listData) => {
        listData.list.setEntries(entries)
      })
   },

   addEntry (clientExpression, listName, entryName) {
    getListData(clientExpression, listName).forEach((listData) => {
      listData.list.addEntry(entryName)
    })
   },

   removeEntry (clientExpression, listName, entryName) {
    getListData(clientExpression, listName).forEach((listData) => {
      listData.list.removeEntry(entryName)
    })
   },


  /** ******************************************************************************************************************************
   *********************************************************** ANONYMOUS RECORDS ************************************************************
   ********************************************************************************************************************************/

   getAnonymousRecord (clientExpression) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.record.anonymousRecord = client.client.record.getAnonymousRecord()
    })
   },

   setName (clientExpression, recordName) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.record.anonymousRecord.setName(recordName)
    })
   }
}

module.exports.assert = {

  deleted (clientExpression, recordName) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      sinon.assert.calledOnce(recordData.deleteCallback)
      recordData.deleteCallback.reset()
    })
  },

  discarded (clientExpression, recordName) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      sinon.assert.calledOnce(recordData.discardCallback)
      recordData.discardCallback.reset()
    })
  },

  recievedUpdate (clientExpression, recordName, data) {
    data = utils.parseData(data)
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      sinon.assert.calledOnce(recordData.subscribeCallback)
      sinon.assert.calledWith(recordData.subscribeCallback, data)
      recordData.subscribeCallback.reset()
    })
  },

  recievedUpdateForPath (clientExpression, recordName, path, data) {
    data = utils.parseData(data)
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      sinon.assert.calledOnce(recordData.subscribePathCallbacks[path])
      sinon.assert.calledWith(recordData.subscribePathCallbacks[path], data)
      recordData.subscribePathCallbacks[path].reset()
    })
  },

  recievedNoUpdate (clientExpression, recordName) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      sinon.assert.notCalled(recordData.subscribeCallback)
    })
  },

  recievedNoUpdateForPath (clientExpression, recordName, path) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      sinon.assert.notCalled(recordData.subscribePathCallbacks[path])
    })
  },

  hasData (clientExpression, recordName, data) {
    data = utils.parseData(data)
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      assert.deepEqual(recordData.record.get(), data)
    })
  },

  hasDataAtPath (clientExpression, recordName, path, data) {
    data = utils.parseData(data)
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      assert.deepEqual(recordData.record.get(path), data)
    })
  },

  writeAckSuccess (clientExpression, recordName) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      if (!recordData) return
      sinon.assert.calledOnce(recordData.setCallback)
      sinon.assert.calledWith(recordData.setCallback, null)
      recordData.setCallback.reset()
    })
    clientHandler.getClients(clientExpression).forEach((client) => {
      if (!client.record.writeAcks) return
      sinon.assert.calledOnce(client.record.writeAcks[recordName])
      sinon.assert.calledWith(client.record.writeAcks[recordName], null)
      client.record.writeAcks[recordName].reset()
    })
  },

  writeAckError (clientExpression, recordName, errorMessage) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      sinon.assert.calledOnce(recordData.setCallback)
      sinon.assert.calledWith(recordData.setCallback, errorMessage)
      recordData.setCallback.reset()
    })
  },

  snapshotSuccess (clientExpression, recordName, data) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.calledOnce(client.record.snapshotCallback)
      sinon.assert.calledWith(client.record.snapshotCallback, null, utils.parseData(data))
      client.record.snapshotCallback.reset()
    })
  },

  snapshotError (clientExpression, recordName, data) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.calledOnce(client.record.snapshotCallback)
      sinon.assert.calledWith(client.record.snapshotCallback, data.replace(/"/g, ''))
      client.record.snapshotCallback.reset()
    })
  },

  headSuccess (clientExpression, recordName, data) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.calledOnce(client.record.headCallback)
      sinon.assert.calledWith(client.record.headCallback, null, utils.parseData(data))
      client.record.headCallback.reset()
    })
  },

  headError (clientExpression, recordName, data) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.calledOnce(client.record.headCallback)
      sinon.assert.calledWith(client.record.headCallback, data.replace(/"/g, ''))
      client.record.snapshotCallback.reset()
    })
  },

  has (clientExpression, recordName, expected) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.calledOnce(client.record.hasCallback)
      sinon.assert.calledWith(client.record.hasCallback, null, expected)
      client.record.hasCallback.reset()
    })
  },

  hasEntries (clientExpression, listName, data) {
    data = utils.parseData(data)
    getListData(clientExpression, listName).forEach((listData) => {
      assert.deepEqual(listData.list.getEntries(), data)
    })
  },

  addedNotified (clientExpression, listName, entryName, action) {
    getListData(clientExpression, listName).forEach((listData) => {
      sinon.assert.calledWith(listData.addedCallback, entryName)
    })
  },

  removedNotified (clientExpression, listName, entryName, action) {
    getListData(clientExpression, listName).forEach((listData) => {
      sinon.assert.calledWith(listData.removedCallback, entryName)
    })
  },

  movedNotified (clientExpression, listName, entryName, action) {
    getListData(clientExpression, listName).forEach((listData) => {
      sinon.assert.calledWith(listData.movedNotified, entryName)
    })
  },

  listChanged (clientExpression, listName, data) {
    data = utils.parseData(data)
    getListData(clientExpression, listName).forEach((listData) => {
        // sinon.assert.calledOnce( listData.subscribeCallback );
      sinon.assert.calledWith(listData.subscribeCallback, data)
    })
  },

  anonymousRecordContains (clientExpression, data) {
    data = utils.parseData(data)
    clientHandler.getClients(clientExpression).forEach((client) => {
      assert.deepEqual(client.record.anonymousRecord.get(), data)
    })
  }
}

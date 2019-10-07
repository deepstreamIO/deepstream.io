import * as sinon from 'sinon'
import { clientHandler } from './client-handler'
import { client as cl } from './client'
import * as utils from './utils'
import * as assert from 'assert'

function getRecordData (clientExpression: string, recordName: string) {
  return clientHandler.getClients(clientExpression).map((client) => client.record.records[recordName])
}

function getListData (clientExpression: string, listName: string) {
  return clientHandler.getClients(clientExpression).map((client) => client.record.lists[listName])
}

const assert2 = {
    deleted (clientExpression: string, recordName: string, called: boolean) {
        getRecordData(clientExpression, recordName).forEach((recordData) => {
            if (called) {
              sinon.assert.calledOnce(recordData.deleteCallback)
              recordData.deleteCallback.resetHistory()
            } else {
              sinon.assert.notCalled(recordData.deleteCallback)
            }
            recordData.deleteCallback.resetHistory()
        })
    },

    discarded (clientExpression: string, recordName: string, called: boolean) {
        getRecordData(clientExpression, recordName).forEach((recordData) => {
            if (called) {
                sinon.assert.calledOnce(recordData.discardCallback)
                recordData.discardCallback.resetHistory()
            } else {
                sinon.assert.notCalled(recordData.discardCallback)
            }
        })
    },

    receivedUpdate (clientExpression: string, recordName: string, data: string) {
        data = utils.parseData(data)
        getRecordData(clientExpression, recordName).forEach((recordData) => {
            sinon.assert.calledOnce(recordData.subscribeCallback)
            sinon.assert.calledWith(recordData.subscribeCallback, data)
            recordData.subscribeCallback.resetHistory()
        })
    },

    receivedUpdateForPath (clientExpression: string, recordName: string, path: string, data: string) {
        data = utils.parseData(data)
        getRecordData(clientExpression, recordName).forEach((recordData) => {
            sinon.assert.calledOnce(recordData.subscribePathCallbacks[path])
            sinon.assert.calledWith(recordData.subscribePathCallbacks[path], data)
            recordData.subscribePathCallbacks[path].resetHistory()
        })
    },

    receivedNoUpdate (clientExpression: string, recordName: string) {
        getRecordData(clientExpression, recordName).forEach((recordData) => {
            sinon.assert.notCalled(recordData.subscribeCallback)
        })
    },

    receivedNoUpdateForPath (clientExpression: string, recordName: string, path: string) {
        getRecordData(clientExpression, recordName).forEach((recordData) => {
            sinon.assert.notCalled(recordData.subscribePathCallbacks[path])
        })
    },

    receivedRecordError (clientExpression: string, error: string, recordName: string) {
        cl.receivedOneError(clientExpression, 'RECORD', error)

        // getRecordData(clientExpression, recordName).forEach((recordData) => {
            // sinon.assert.calledWith(recordData.errorCallback, error)
            // recordData.errorCallback.resetHistory()
        // })
    },

    hasData (clientExpression: string, recordName: string, data: string) {
        data = utils.parseData(data)
        getRecordData(clientExpression, recordName).forEach((recordData) => {
            assert.deepEqual(recordData.record.get(), data)
        })
    },

    hasProviders (clientExpression: string, recordName: string, without: boolean) {
        getRecordData(clientExpression, recordName).forEach((recordData) => {
            assert.deepEqual(recordData.record.hasProvider, !without)
        })
    },

    hasDataAtPath (clientExpression: string, recordName: string, path: string, data: string) {
        data = utils.parseData(data)
        getRecordData(clientExpression, recordName).forEach((recordData) => {
            assert.deepEqual(recordData.record.get(path), data)
        })
    },

    writeAckSuccess (clientExpression: string, recordName: string) {
        getRecordData(clientExpression, recordName).forEach((recordData) => {
            if (!recordData) { return }
            sinon.assert.calledOnce(recordData.setCallback)
            sinon.assert.calledWith(recordData.setCallback, null)
            recordData.setCallback.resetHistory()
        })
        clientHandler.getClients(clientExpression).forEach((client) => {
            if (!client.record.writeAcks) { return }
            sinon.assert.calledOnce(client.record.writeAcks[recordName])
            sinon.assert.calledWith(client.record.writeAcks[recordName], null)
            client.record.writeAcks[recordName].resetHistory()
        })
    },

    writeAckError (clientExpression: string, recordName: string, errorMessage: string) {
        cl.receivedOneError(clientExpression, 'RECORD', errorMessage)

        // getRecordData(clientExpression, recordName).forEach((recordData) => {
        //     if (!recordData) { return }
        //     sinon.assert.calledOnce(recordData.setCallback)
        //     sinon.assert.calledWith(recordData.setCallback, errorMessage)
        //     recordData.setCallback.resetHistory()
        // })
        // clientHandler.getClients(clientExpression).forEach((client) => {
        //     if (!client.record.writeAcks) { return }
        //     sinon.assert.calledOnce(client.record.writeAcks[recordName])
        //     sinon.assert.calledWith(client.record.writeAcks[recordName], errorMessage)
        //     client.record.writeAcks[recordName].resetHistory()
        // })
    },

    snapshotSuccess (clientExpression: string, recordName: string, data: string) {
        clientHandler.getClients(clientExpression).forEach((client) => {
            sinon.assert.calledOnce(client.record.snapshotCallback)
            sinon.assert.calledWith(client.record.snapshotCallback, null, utils.parseData(data))
            client.record.snapshotCallback.resetHistory()
        })
    },

    snapshotError (clientExpression: string, recordName: string, data: string) {
        cl.receivedOneError(clientExpression, 'RECORD', data)

        // clientHandler.getClients(clientExpression).forEach((client) => {
        //     sinon.assert.calledOnce(client.record.snapshotCallback)
        //     sinon.assert.calledWith(client.record.snapshotCallback, data.replace(/"/g, ''))
        //     client.record.snapshotCallback.resetHistory()
        // })
    },

    headSuccess (clientExpression: string, recordName: string, data: number) {
        clientHandler.getClients(clientExpression).forEach((client) => {
            sinon.assert.calledOnce(client.record.headCallback)
            sinon.assert.calledWith(client.record.headCallback, null, data)
            client.record.headCallback.resetHistory()
        })
    },

    headError (clientExpression: string, recordName: string, data: string) {
        clientHandler.getClients(clientExpression).forEach((client) => {
            sinon.assert.calledOnce(client.record.headCallback)
            sinon.assert.calledWith(client.record.headCallback, data.replace(/"/g, ''))
            client.record.snapshotCallback.resetHistory()
        })
    },

    has (clientExpression: string, recordName: string, expected: boolean) {
        clientHandler.getClients(clientExpression).forEach((client) => {
            sinon.assert.calledOnce(client.record.hasCallback)
            sinon.assert.calledWith(client.record.hasCallback, null, expected)
            client.record.hasCallback.resetHistory()
        })
    },

    hasEntries (clientExpression: string, listName: string, data: string) {
        data = utils.parseData(data)
        getListData(clientExpression, listName).forEach((listData) => {
            assert.deepEqual(listData.list.getEntries(), data)
        })
    },

    addedNotified (clientExpression: string, listName: string, entryName: string) {
        getListData(clientExpression, listName).forEach((listData) => {
            sinon.assert.calledWith(listData.addedCallback, entryName)
        })
    },

    removedNotified (clientExpression: string, listName: string, entryName: string) {
        getListData(clientExpression, listName).forEach((listData) => {
            sinon.assert.calledWith(listData.removedCallback, entryName)
        })
    },

    movedNotified (clientExpression: string, listName: string, entryName: string) {
        getListData(clientExpression, listName).forEach((listData) => {
            sinon.assert.calledWith(listData.movedNotified, entryName)
        })
    },

    listChanged (clientExpression: string, listName: string, data: string) {
        data = utils.parseData(data)
        getListData(clientExpression, listName).forEach((listData) => {
            // sinon.assert.calledOnce( listData.subscribeCallback );
            sinon.assert.calledWith(listData.subscribeCallback, data)
        })
    },

    anonymousRecordContains (clientExpression: string, data: string) {
        data = utils.parseData(data)
        clientHandler.getClients(clientExpression).forEach((client) => {
            assert.deepEqual(client.record.anonymousRecord.get(), data)
        })
    }
}

export const record = {
  assert: assert2,

  getRecord (clientExpression: string, recordName: string) {
    const clients = clientHandler.getClients(clientExpression)
    clients.forEach((client) => {
      const recordData = {
        record: client.client.record.getRecord(recordName),
        discardCallback: sinon.spy(),
        deleteSuccessCallback: sinon.spy(),
        deleteCallback: sinon.spy(),
        callbackError: sinon.spy(),
        subscribeCallback: sinon.spy(),
        errorCallback: sinon.spy(),
        setCallback: undefined,
        subscribePathCallbacks: {}
      }
      recordData.record.on('delete', recordData.deleteCallback)
      recordData.record.on('error', recordData.errorCallback)
      recordData.record.on('discard', recordData.discardCallback)
      client.record.records[recordName] = recordData
    })
  },

  subscribe (clientExpression: string, recordName: string, immediate: boolean) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      recordData.record.subscribe(recordData.subscribeCallback, !!immediate)
    })
  },

  unsubscribe (clientExpression: string, recordName: string) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      recordData.record.unsubscribe(recordData.subscribeCallback)
    })
  },

  subscribeWithPath (clientExpression: string, recordName: string, path: string, immediate: boolean) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      recordData.subscribePathCallbacks[path] = sinon.spy()
      recordData.record.subscribe(path, recordData.subscribePathCallbacks[path], !!immediate)
    })
  },

  unsubscribeFromPath (clientExpression: string, recordName: string, path: string) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      recordData.record.unsubscribe(path, recordData.subscribePathCallbacks[path])
    })
  },

  discard (clientExpression: string, recordName: string) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      recordData.record.discard()
    })
  },

  delete (clientExpression: string, recordName: string) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      recordData.record.delete(recordData.deleteSuccessCallback)
    })
  },

  setupWriteAck (clientExpression: string, recordName: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.record.records[recordName].setCallback = sinon.spy()
    })
  },

  set (clientExpression: string, recordName: string, data: string) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      if (recordData.setCallback) {
        recordData.record.set(utils.parseData(data), recordData.setCallback)
      } else {
        recordData.record.set(utils.parseData(data))
      }
    })
  },

  setWithPath (clientExpression: string, recordName: string, path: string, data: string) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      if (recordData.setCallback) {
        recordData.record.set(path, utils.parseData(data), recordData.setCallback)
      } else {
        recordData.record.set(path, utils.parseData(data))
      }
    })
  },

  erase (clientExpression: string, recordName: string, path: string) {
    getRecordData(clientExpression, recordName).forEach((recordData) => {
      if (recordData.setCallback) {
        recordData.record.set(path, undefined, recordData.setCallback)
      } else {
        recordData.record.set(path, undefined)
      }
    })
  },

  setData (clientExpression: string, recordName: string, data: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.record.setData(recordName, utils.parseData(data))
    })
  },

  setDataWithWriteAck (clientExpression: string, recordName: string, data: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      if (!client.record.writeAcks) {
        client.record.writeAcks = {}
      }
      client.record.writeAcks[recordName] = sinon.spy()
      client.client.record.setData(recordName, utils.parseData(data), client.record.writeAcks[recordName])
    })
  },

  setDataWithPath (clientExpression: string, recordName: string, path: string, data: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.record.setData(recordName, path, utils.parseData(data))
    })
  },

  snapshot (clientExpression: string, recordName: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.record.snapshot(recordName, client.record.snapshotCallback)
    })
  },

  has (clientExpression: string, recordName: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.record.has(recordName, client.record.hasCallback)
    })
  },

  head (clientExpression: string, recordName: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.record.head(recordName, client.record.headCallback)
    })
  },

  /** ******************************************************************************************************************************
   *********************************************************** Lists ************************************************************
   ********************************************************************************************************************************/

   getList (clientExpression: string, listName: string) {
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

   setEntries (clientExpression: string, listName: string, data: string) {
      const entries = utils.parseData(data)
      getListData(clientExpression, listName).forEach((listData) => {
        listData.list.setEntries(entries)
      })
   },

   addEntry (clientExpression: string, listName: string, entryName: string) {
    getListData(clientExpression, listName).forEach((listData) => {
      listData.list.addEntry(entryName)
    })
   },

   removeEntry (clientExpression: string, listName: string, entryName: string) {
    getListData(clientExpression, listName).forEach((listData) => {
      listData.list.removeEntry(entryName)
    })
   },

  /** ******************************************************************************************************************************
   *********************************************************** ANONYMOUS RECORDS ************************************************************
   ********************************************************************************************************************************/

   getAnonymousRecord (clientExpression: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.record.anonymousRecord = client.client.record.getAnonymousRecord()
    })
   },

   setName (clientExpression: string, recordName: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.record.anonymousRecord.setName(recordName)
    })
   }
}

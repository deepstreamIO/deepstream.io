import 'mocha'
import { expect } from 'chai'

import * as M from './test-messages'
import * as C from '../../constants'
import { getTestMocks } from '../../test/helper/test-mocks'
import * as testHelper from '../../test/helper/test-helper'
import { RecordTransition } from './record-transition'
import { PromiseDelay } from '../../utils/utils';

describe('RecordTransition', () => {
  let services: any
  let config: any
  // let socketWrapper
  let recordTransition: any
  let testMocks: any
  let client: any

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper()

    const options = testHelper.getDeepstreamOptions()
    services = options.services
    config = options.config

    recordTransition = new RecordTransition(M.recordUpdate.name, config, services, testMocks.recordHandler, {})

  })

  afterEach(() => {
    client.socketWrapperMock.verify()
    testMocks.recordHandlerMock.verify()
  })

  it('sends write acknowledgement with sync cache and async storage', async () => {
    const message: C.RecordWriteMessage = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'random-name',
      correlationId: '30',
      data: 'somedata',
      isWriteAck: true,
      version: -1,
      parsedData: { name: 'somedata' }
    }

    services.storage.nextOperationWillBeSuccessful = true
    services.storage.nextOperationWillBeSynchronous = false

    services.cache.nextOperationWillBeSuccessful = true
    services.cache.nextOperationWillBeSynchronous = true

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.WRITE_ACKNOWLEDGEMENT,
        name: message.name,
        correlationId: message.correlationId,
        isWriteAck: true
      })

    recordTransition.add(client.socketWrapper, message, true)

    // Wait for the async callback to fire
    await PromiseDelay(60)
  })
})

describe('record transitions', () => {
  let services: any
  let config: any
  let recordTransition: any
  let testMocks: any
  let client: any

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper()

    const options = testHelper.getDeepstreamOptions()
    services = options.services
    config = options.config

    recordTransition = new RecordTransition(M.recordUpdate.name, config, services, testMocks.recordHandler, {})
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
    testMocks.recordHandlerMock.verify()
  })

  it('applies an update and broadcasts a completed transition', () => {
    services.cache.set(M.recordUpdate.name, M.recordVersion, Object.assign({}, M.recordData), () => {})

    testMocks.recordHandlerMock
      .expects('broadcastUpdate')
      .once()
      .withExactArgs(M.recordUpdate.name, M.recordUpdate, false, client.socketWrapper)

    testMocks.recordHandlerMock
      .expects('transitionComplete')
      .once()
      .withExactArgs(M.recordUpdate.name)

    recordTransition.add(client.socketWrapper, M.recordUpdate)
  })

  it('sends INVALID_MESSAGE_DATA when data is malformed JSON', () => {
    const invalidMessage = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'bob',
      version: 1,
      data: '{ b ]'
    }

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.INVALID_MESSAGE_DATA,
        data: invalidMessage.data
      })

    recordTransition.add(client.socketWrapper, invalidMessage as any)
  })

  it('sends INVALID_MESSAGE_DATA when data is a non-JSON string', () => {
    const invalidMessage = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'bob',
      version: 1,
      data: 'This is a string'
    }

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.INVALID_MESSAGE_DATA,
        data: invalidMessage.data
      })

    recordTransition.add(client.socketWrapper, invalidMessage as any)
  })

  it('sends INVALID_MESSAGE_DATA when data parses to null', () => {
    const invalidMessage: any = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'bob',
      version: 1,
      data: 'null'
    }

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.INVALID_MESSAGE_DATA,
        name: 'bob',
        version: 1,
        data: 'null',
        parsedData: null,
        originalAction: C.RECORD_ACTION.UPDATE
      })

    recordTransition.add(client.socketWrapper, invalidMessage)
  })

  it('sends INVALID_MESSAGE_DATA when data parses to a number', () => {
    const invalidMessage: any = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'bob',
      version: 1,
      data: '1234'
    }

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.INVALID_MESSAGE_DATA,
        name: 'bob',
        version: 1,
        data: '1234',
        parsedData: 1234,
        originalAction: C.RECORD_ACTION.UPDATE
      })

    recordTransition.add(client.socketWrapper, invalidMessage)
  })

  it('hasVersion returns true for every version up to lastVersion and false above', () => {
    services.cache.set(M.recordUpdate.name, M.recordVersion, Object.assign({}, M.recordData), () => {})

    testMocks.recordHandlerMock.expects('broadcastUpdate').once()
    testMocks.recordHandlerMock.expects('transitionComplete').once()

    recordTransition.add(client.socketWrapper, M.recordUpdate)

    expect(recordTransition.hasVersion(-1)).to.equal(false)
    expect(recordTransition.hasVersion(0)).to.equal(true)
    expect(recordTransition.hasVersion(M.recordUpdate.version - 1)).to.equal(true)
    expect(recordTransition.hasVersion(M.recordUpdate.version)).to.equal(true)
    expect(recordTransition.hasVersion(M.recordUpdate.version + 1)).to.equal(false)
    expect(recordTransition.hasVersion(M.recordUpdate.version + 2)).to.equal(false)
  })

  it('destroys the transition and ignores subsequent destroys', (done) => {
    services.cache.nextGetWillBeSynchronous = false

    recordTransition.add(client.socketWrapper, M.recordUpdate)
    recordTransition.destroy()
    expect(recordTransition.isDestroyed).to.equal(true)

    recordTransition.destroy()
    expect(recordTransition.isDestroyed).to.equal(true)

    setTimeout(done, 50)
  })

  it('errors when the record does not exist and upsert is disabled', () => {
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.RECORD_UPDATE_ERROR,
        name: M.recordUpdate.name,
        isError: true,
        isWriteAck: M.recordUpdate.isWriteAck,
        correlationId: undefined
      })

    testMocks.recordHandlerMock
      .expects('transitionComplete')
      .once()
      .withExactArgs(M.recordUpdate.name)

    recordTransition.add(client.socketWrapper, M.recordUpdate)

    expect(services.logger.logSpy.calledWith(
      3,
      C.RECORD_ACTION[C.RECORD_ACTION.RECORD_UPDATE_ERROR],
      `Received update for non-existant record ${M.recordUpdate.name}`
    )).to.equal(true)
  })

  it('does not write to storage when the record is excluded by prefix', () => {
    const excludedName = 'no-storage/1'
    const excludedUpdate = Object.assign({}, M.recordUpdate, { name: excludedName, version: 1 })
    recordTransition = new RecordTransition(excludedName, config, services, testMocks.recordHandler, {})

    testMocks.recordHandlerMock.expects('broadcastUpdate').once()
    testMocks.recordHandlerMock.expects('transitionComplete').once()

    recordTransition.add(client.socketWrapper, excludedUpdate, true)

    expect(services.storage.lastSetKey).to.equal(null)
    expect(services.storage.completedSetOperations).to.equal(0)
    expect(services.cache.lastSetKey).to.equal(excludedName)
  })

  // ---------------------------------------------------------------------------
  // Legacy tests not ported. They depend on harness that no longer exists
  // (recordRequestMockCallback, createRecordTransition, SocketMock, the
  // wire-format `msg()` helper, the 3-argument `add(sw, version, message)`
  // signature, or private `steps`/`_record` fields). Kept as reference.
  // ---------------------------------------------------------------------------
  /*
  it('adds an update to the queue', () => {
    services.cache.nextGetWillBeSynchronous = false

    expect(recordTransition.steps.length).to.equal(0)
    recordTransition.add(client.socketWrapper, M.recordUpdate)
    expect(recordTransition.steps.length).to.equal(1)
  })

  it.skip('retrieves the empty record', (done) => {
    recordRequestMockCallback({ _v: 0, _d: { firstname: 'Egon' } })

    expect(recordTransition._record).to.deep.equal({ _v: 1, _d: { firstname: 'Egon' } })
    expect(services.cache.completedSetOperations).to.equal(0)

    const check = setInterval(() => {
      if (services.cache.completedSetOperations === 1) {
        expect(recordHandlerMock._$broadcastUpdate).to.have.been.calledWith('recordName', patchMessage, false, socketWrapper)
        expect(recordHandlerMock._$transitionComplete).to.have.callCount(0)
        expect(recordTransition._record).to.deep.equal({ _v: 2, _d: { lastname: 'Peterson' } })
        clearInterval(check)
        done()
      }
    }, 1)
  })

  it.skip('receives a patch message whilst the transition is in progress', () => {
    expect(recordHandlerMock._$transitionComplete).to.have.callCount(0)
    recordTransition.add(socketWrapper, 3, patchMessage2)
  })

  it.skip('processes a queue', (done) => {
    testMocks.recordHandlerMock
      .expects('broadcastUpdate')
      .once()
      .withExactArgs(M.recordPatch.name, M.recordPatch, false, client.socketWrapper)

    testMocks.recordHandlerMock
      .expects('broadcastUpdate')
      .once()
      .withExactArgs(M.recordUpdate.name, M.recordUpdate, false, client.socketWrapper)

    testMocks.recordHandlerMock
      .expects('transitionComplete')
      .once()
      .withExactArgs(M.recordPatch.name)

    client.socketWrapperMock
      .expects('sendError')
      .never()

    recordTransition.add(client.socketWrapper, M.recordPatch)
    recordTransition.add(client.socketWrapper, Object.assign({}, M.recordUpdate, { version: M.recordUpdate.version + 1 }))
    recordTransition.add(client.socketWrapper, Object.assign({}, M.recordUpdate, { version: M.recordUpdate.version + 2 }))
  })

  describe('destroys a transition between steps', () => {
    const secondPatchMessage = { topic: 'RECORD', action: 'P', data: ['recordName', 2, 'firstname', 'SEgon'] }

    before(() => {
      createRecordTransition()
      services.cache.nextOperationWillBeSynchronous = false
    })

    it('adds a patch to the queue', () => {
      expect(() => {
        recordTransition.add(socketWrapper, 2, secondPatchMessage)
        expect(recordTransition.hasVersion(2)).to.equal(true)
      }).not.to.throw()
    })
  })

  describe('tries to set a record, but both cache and storage fail', () => {
    before(() => {
      createRecordTransition()
      services.cache.nextOperationWillBeSynchronous = true
      services.cache.nextOperationWillBeSuccessful = false
      services.storage.nextOperationWillBeSuccessful = false
      recordRequestMockCallback()
    })

    it('logged an error', () => {
      expect(services.logger.logSpy).to.have.been.calledWith(3, 'RECORD_UPDATE_ERROR', 'storageError')
    })
  })

  describe('recordRequest returns an error', () => {
    before(() => {
      createRecordTransition()
      services.cache.nextOperationWillBeSynchronous = false
    })

    it('receives an error', () => {
      expect(socketWrapper.socket.lastSendMessage).to.equal(null)
      recordRequestMockCallback('errorMsg', true)
      expect(services.logger.logSpy).to.have.been.calledWith(3, 'RECORD_UPDATE_ERROR', 'errorMsg')
      expect(socketWrapper.socket.lastSendMessage).to.equal(msg('R|E|RECORD_UPDATE_ERROR|1+'))
    })
  })

  describe('handles invalid message data', () => {
    const invalidPatchMessage = { topic: 'RECORD', action: 'P', data: ['recordName', 2, 'somepath', 'O{"invalid":"json'] }

    before(() => {
      createRecordTransition('recordName', invalidPatchMessage)
      services.cache.nextOperationWillBeSynchronous = false
    })

    it('receives an error', () => {
      expect(socketWrapper.socket.lastSendMessage).to.contain(msg('R|E|INVALID_MESSAGE_DATA|'))
    })
  })

  describe.skip('transition version conflicts', () => {
    const socketMock1 = new SocketMock()
    const socketMock2 = new SocketMock()
    const socketMock3 = new SocketMock()
    const socketWrapper1 = new SocketWrapper(socketMock1)
    const socketWrapper2 = new SocketWrapper(socketMock2)
    const socketWrapper3 = new SocketWrapper(socketMock3)
    const patchMessage2 = { topic: 'RECORD', action: 'P', data: ['recordName', 2, 'firstname', 'SEgon'] }

    before(() => {
      createRecordTransition('recordName')
      services.cache.nextOperationWillBeSynchronous = false
    })

    it('gets a version exist error on two seperate updates but does not send error', () => {
      recordTransition.add(socketWrapper1, 2, patchMessage2)

      recordTransition.sendVersionExists({ sender: socketWrapper1, version: 1, message: patchMessage })
      recordTransition.sendVersionExists({ sender: socketWrapper2, version: 1, message: patchMessage2 })

      expect(socketMock1.lastSendMessage).to.equal(null)
      expect(socketMock2.lastSendMessage).to.equal(null)
      expect(socketMock3.lastSendMessage).to.equal(null)
    })

    it('sends version exists error once record request is completed is retrieved', () => {
      recordRequestMockCallback({ _v: 1, _d: { lastname: 'Kowalski' } })

      expect(socketMock1.lastSendMessage).to.equal(msg('R|E|VERSION_EXISTS|recordName|1|{"lastname":"Kowalski"}+'))
      expect(socketMock2.lastSendMessage).to.equal(msg('R|E|VERSION_EXISTS|recordName|1|{"lastname":"Kowalski"}+'))
      expect(socketMock3.lastSendMessage).to.equal(null)
    })

    it('immediately sends version exists when record is already loaded', () => {
      socketMock1.lastSendMessage = null
      socketMock2.lastSendMessage = null
      socketMock3.lastSendMessage = null

      recordTransition.sendVersionExists({ sender: socketWrapper3, version: 1, message: patchMessage })

      expect(socketMock1.lastSendMessage).to.equal(null)
      expect(socketMock2.lastSendMessage).to.equal(null)
      expect(socketMock3.lastSendMessage).to.equal(msg('R|E|VERSION_EXISTS|recordName|2|{"lastname":"Kowalski","firstname":"Egon"}+'))
    })

    it('destroys the transition', (done) => {
      recordTransition.destroy()
      expect(recordTransition.isDestroyed).to.equal(true)
      expect(recordTransition.steps).to.equal(null)
      setTimeout(() => {
        // just leave this here to make sure no error is thrown when the
        // record request returns after 30ms
        done()
      }, 50)
    })
  })
  */
})

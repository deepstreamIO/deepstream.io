import {expect} from 'chai'
import PermissionHandlerMock from '../test/mock/permission-handler-mock'
import MessageProcessor from './message-processor'
import LoggerMock from '../test/mock/logger-mock'
import { getTestMocks } from '../test/helper/test-mocks'
import { TOPIC, CONNECTION_ACTION, RPC_ACTION, RECORD_ACTION } from '../constants';

let messageProcessor
let log
let lastAuthenticatedMessage = null

describe('the message processor only forwards valid, authorized messages', () => {
  let testMocks
  let client
  let permissionMock

  const message = {
    topic: TOPIC.RECORD,
    action: RECORD_ACTION.READ,
    name: 'record/name'
  }

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper('someUser')
    permissionMock  = new PermissionHandlerMock()
    const loggerMock = new LoggerMock()
    log = loggerMock.logSpy
    messageProcessor = new MessageProcessor({}, {
      permission: permissionMock,
      logger: loggerMock
    })
    messageProcessor.onAuthenticatedMessage = function (socketWrapper, authenticatedMessage) {
      lastAuthenticatedMessage = authenticatedMessage
    }
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
  })

  it('handles permission errors', () => {
    permissionMock.nextCanPerformActionResult = 'someError'

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: TOPIC.RECORD,
        action: RECORD_ACTION.MESSAGE_PERMISSION_ERROR,
        originalAction: RECORD_ACTION.READ,
        name: message.name,
        isError: true
      })

    messageProcessor.process(client.socketWrapper, [message])

    expect(log).to.have.callCount(1)
    expect(log).to.have.been.calledWith(2, RECORD_ACTION[RECORD_ACTION.MESSAGE_PERMISSION_ERROR], 'someError')
  })

  it('rpc permission errors have a correlation id', () => {
    permissionMock.nextCanPerformActionResult = 'someError'
    const rpcMessage = {
      topic: TOPIC.RPC,
      action: RPC_ACTION.REQUEST,
      name: 'myRPC',
      correlationId: '1234567890',
      data: Buffer.from('{}', 'utf8'),
      parsedData: {}
    }

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: TOPIC.RPC,
        action: RPC_ACTION.MESSAGE_PERMISSION_ERROR,
        originalAction: rpcMessage.action,
        name: rpcMessage.name,
        correlationId: rpcMessage.correlationId,
        isError: true
      })

    messageProcessor.process(client.socketWrapper, [rpcMessage])

    expect(log).to.have.callCount(1)
    expect(log).to.have.been.calledWith(2, RPC_ACTION[RPC_ACTION.MESSAGE_PERMISSION_ERROR], 'someError')
  })

  it('handles denied messages', () => {
    permissionMock.nextCanPerformActionResult = false

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: TOPIC.RECORD,
        action: RECORD_ACTION.MESSAGE_DENIED,
        originalAction: RECORD_ACTION.READ,
        name: message.name,
        isError: true
      })

    messageProcessor.process(client.socketWrapper, [message])
  })

  it('provides the correct arguments to canPerformAction', () => {
    permissionMock.nextCanPerformActionResult = false

    messageProcessor.process(client.socketWrapper, [message])

    expect(permissionMock.lastCanPerformActionQueryArgs.length).to.equal(4)
    expect(permissionMock.lastCanPerformActionQueryArgs[0]).to.equal(client.socketWrapper)
    expect(permissionMock.lastCanPerformActionQueryArgs[1]).to.deep.equal(message)
    expect(permissionMock.lastCanPerformActionQueryArgs[3]).to.deep.equal({})
  })

  it('forwards validated and permissioned messages', () => {
    permissionMock.nextCanPerformActionResult = true

    messageProcessor.process(client.socketWrapper, [message])

    expect(lastAuthenticatedMessage).to.equal(message as any)
  })
})

import * as C from '../../src/constants'
import PermissionHandlerMock from '../test-mocks/permission-handler-mock'
const MessageProcessor = require('../../src/message/message-processor').default
import LoggerMock from '../test-mocks/logger-mock'
import { getTestMocks } from '../test-helper/test-mocks'

let messageProcessor
let log
let lastAuthenticatedMessage = null

describe('the message processor only forwards valid, authorized messages', () => {
  let testMocks
  let client
  let permissionHandlerMock

  const message = {
    topic: C.TOPIC.RECORD,
    action: C.RECORD_ACTIONS.READ,
    name: 'record/name'
  }

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper('someUser')
    permissionHandlerMock  = new PermissionHandlerMock()
    const loggerMock = new LoggerMock()
    log = loggerMock._log
    messageProcessor = new MessageProcessor({}, {
      permissionHandler: permissionHandlerMock,
      logger: loggerMock
    })
    messageProcessor.onAuthenticatedMessage = function (socketWrapper, authenticatedMessage) {
      lastAuthenticatedMessage = authenticatedMessage
    }
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
  })

  it('ignores heartbeats pongs messages', () => {
    client.socketWrapperMock
      .expects('sendMessage')
      .never()

    messageProcessor.process(client.socketWrapper, [{ topic: 'C', action: 'PO' }])
  })

  it('handles permission errors', () => {
    permissionHandlerMock.nextCanPerformActionResult = 'someError'

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(message, C.RECORD_ACTIONS.MESSAGE_PERMISSION_ERROR)

    messageProcessor.process(client.socketWrapper, [message])

    expect(log).toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(2, C.RECORD_ACTIONS[C.RECORD_ACTIONS.MESSAGE_PERMISSION_ERROR], 'someError')
  })

  it('handles denied messages', () => {
    permissionHandlerMock.nextCanPerformActionResult = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(message, C.RECORD_ACTIONS.MESSAGE_DENIED)

    messageProcessor.process(client.socketWrapper, [message])
  })

  it('provides the correct arguments to canPerformAction', () => {
    permissionHandlerMock.nextCanPerformActionResult = false

    messageProcessor.process(client.socketWrapper, [message])

    expect(permissionHandlerMock.lastCanPerformActionQueryArgs.length).toBe(5)
    expect(permissionHandlerMock.lastCanPerformActionQueryArgs[0]).toBe('someUser')
    expect(permissionHandlerMock.lastCanPerformActionQueryArgs[1].name).toBe('record/name')
    expect(permissionHandlerMock.lastCanPerformActionQueryArgs[3]).toEqual({})
    expect(permissionHandlerMock.lastCanPerformActionQueryArgs[4]).toBe(client.socketWrapper)
  })

  it('forwards validated and permissioned messages', () => {
    permissionHandlerMock.nextCanPerformActionResult = true

    messageProcessor.process(client.socketWrapper, [message])

    expect(lastAuthenticatedMessage).toBe(message as any)
  })

  it('does not process auth requests', () => {
    const authMsg = {
      topic: C.TOPIC.AUTH,
      action: C.AUTH_ACTIONS.REQUEST
    }

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs({ topic: C.TOPIC.AUTH }, C.AUTH_ACTIONS.ALREADY_AUTHENTICATED, authMsg)

    messageProcessor.process(client.socketWrapper, [authMsg])
  })
})

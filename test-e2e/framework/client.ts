// tslint:disable:no-shadowed-variable
import * as C from '../../binary-protocol/src/message-constants'
import * as sinon from 'sinon'
import { clientHandler } from './client-handler'

export const client = {
  logsOut (clientExpression, done) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.close()
    })
    // current sync since protocol doesn't yet support async
    done()
  },

  connect (clientExpression, server) {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      clientHandler.createClient(clientName, server)
    })
  },

  connectAndLogin (clientExpression, server, done) {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = clientHandler.createClient(clientName, server)
      client.client.login({ username: clientName, password: 'abcdefgh' }, (success, data) => {
        client.login(success, data)
        client.user = clientName
        done()
      })
    })
  },

  login (clientExpression, username, password, done) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.login({
        username,
        password
      }, (success, data) => {
        client.login(success, data)
        client.user = username
        done()
      })
    })
  },

  attemptLogin (clientExpression, username, password) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.login({
        username,
        password
      })
    })
  },

  recievedTooManyLoginAttempts (clientExpression) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const errorSpy = client.error[C.TOPIC[C.TOPIC.AUTH]][C.AUTH_ACTIONS[C.AUTH_ACTIONS.TOO_MANY_AUTH_ATTEMPTS]]
      sinon.assert.calledOnce(errorSpy)
      errorSpy.resetHistory()
    })
  },

  recievesNoLoginResponse (clientExpression) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.notCalled(client.login)
    })
  },

  recievesLoginResponse (clientExpression, loginFailed, data) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const loginSpy = client.login
      if (!loginFailed) {
        sinon.assert.calledOnce(loginSpy)
        if (data) {
          sinon.assert.calledWith(loginSpy, true, JSON.parse(data))
        } else {
          sinon.assert.calledWith(loginSpy, true)
        }
      } else {
        sinon.assert.calledOnce(loginSpy)
        sinon.assert.calledWith(loginSpy, false)
      }
      loginSpy.resetHistory()
    })
  },

  connectionTimesOut (clientExpression, done) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      setTimeout(() => {
        const errorSpy = client.error[C.TOPIC[C.TOPIC.CONNECTION]][C.CONNECTION_ACTIONS[C.CONNECTION_ACTIONS.AUTHENTICATION_TIMEOUT]]
        sinon.assert.calledOnce(errorSpy)
        errorSpy.resetHistory()
        done()
      }, 1000)
    })
  },

  recievedErrorOnce (clientExpression, topicName, eventName) {
    const topic = topicName.toUpperCase()

    clientHandler.getClients(clientExpression).forEach((client) => {
      const errorSpy = client.error[topic][eventName]
      sinon.assert.called(errorSpy)
      errorSpy.resetHistory()
    })
  },

  recievedOneError (clientExpression, topicName, eventName) {
    const topic = C.TOPIC[C.TOPIC[topicName.toUpperCase()]]
    const event = eventName.toUpperCase()
    clientHandler.getClients(clientExpression).forEach((client) => {
      const errorSpy = client.error[topic][event]
      sinon.assert.calledOnce(errorSpy)
      errorSpy.resetHistory()
    })
  },

  callbackCalled (clientExpression, eventName, notCalled, once, data) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const spy = client[eventName]
      if (notCalled) {
        sinon.assert.notCalled(spy)
      } else {
        if (once) {
          sinon.assert.calledOnce(spy)
        } else {
          sinon.assert.called(spy)
        }
        if (data !== undefined) {
          sinon.assert.calledWith(spy, JSON.parse(data))
        }
      }

      spy.resetHistory()
    })
  },

  recievedNoErrors (clientExpression) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      clientHandler.assertNoErrors(client.name)
    })
  },

  hadConnectionState (clientExpression, had, state) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      if (had) {
        sinon.assert.calledWith(client.connectionStateChanged, state)
      } else {
        sinon.assert.neverCalledWith(client.connectionStateChanged, state)
      }
    })
  },

}

// tslint:disable:no-shadowed-variable
import * as sinon from 'sinon'
import { clientHandler } from './client-handler'

const compat: any = {
  CONNECTION: 'C',
  EVENT: 'E',
  RECORD: 'R',
  PRESENCE: 'U',
  RPC: 'P',
  AUTH: 'A',
  CONNECTION_ERROR: 'connectionError',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND'
}

export const client = {
  logsOut (clientExpression: string, done: Function) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.close()
    })
    // current sync since protocol doesn't yet support async
    done()
  },

  connect (clientExpression: string, server: string) {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      clientHandler.createClient(clientName, server)
    })
  },

  connectAndLogin (clientExpression: string, server: string, done: Function) {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = clientHandler.createClient(clientName, server)
      client.client.login({ username: clientName, password: 'abcdefgh' }, (success: boolean, data: any) => {
        client.login(success, data)
        client.user = clientName
        done()
      })
    })
  },

  login (clientExpression: string, username: string, password: string, done: Function) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.login({
        username,
        password
      }, (success: boolean, data: any) => {
        client.login(success, data)
        client.user = username
        done()
      })
    })
  },

  attemptLogin (clientExpression: string, username: string, password: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.login({
        username,
        password
      })
    })
  },

  recievedTooManyLoginAttempts (clientExpression: string) {
    // Not a < V4 feature
    // clientHandler.getClients(clientExpression).forEach((client) => {
    //   const errorSpy = client.error.A.TOO_MANY_AUTH_ATTEMPTS
    //   sinon.assert.calledOnce(errorSpy)
    //   errorSpy.resetHistory()
    // })
  },

  recievesNoLoginResponse (clientExpression: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.notCalled(client.login)
    })
  },

  recievesLoginResponse (clientExpression: string, loginFailed: boolean, data: string) {
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
        sinon.assert.called(loginSpy)
        sinon.assert.calledWith(loginSpy, false)
      }
      loginSpy.resetHistory()
    })
  },

  connectionTimesOut (clientExpression: string, done: Function) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      setTimeout(() => {
        const errorSpy = client.error.C.CONNECTION_AUTHENTICATION_TIMEOUT
        sinon.assert.calledOnce(errorSpy)
        errorSpy.resetHistory()
        done()
      }, 1000)
    })
  },

  recievedErrorOnce (clientExpression: string, topicName: string, eventName: string) {
    const topic = topicName.toUpperCase()

    clientHandler.getClients(clientExpression).forEach((client) => {
      const errorSpy = client.error[compat[topic]][compat[eventName]]
      sinon.assert.called(errorSpy)
      errorSpy.resetHistory()
    })
  },

  recievedOneError (clientExpression: string, topicName: string, eventName: string) {
    let topic = compat[topicName]
    const event = eventName.toUpperCase()

    clientHandler.getClients(clientExpression).forEach((client) => {
      if (event === 'IS_CLOSED') {
        topic = 'X'
      }
      const errorSpy = client.error[topic][event]
      sinon.assert.calledOnce(errorSpy)
      errorSpy.resetHistory()
    })
  },

  callbackCalled (clientExpression: string, eventName: string, notCalled: boolean, once: boolean, data: string) {
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

  recievedNoErrors (clientExpression: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      clientHandler.assertNoErrors(client.name)
    })
  },

  hadConnectionState (clientExpression: string, had: boolean, state: boolean) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      if (had) {
        sinon.assert.calledWith(client.connectionStateChanged, state)
      } else {
        sinon.assert.neverCalledWith(client.connectionStateChanged, state)
      }
    })
  },

}

// tslint:disable:no-shadowed-variable

import * as sinon from 'sinon'
import { clientHandler, E2EClient } from './client-handler'
import { RPCResponse } from '@deepstream/client/dist/rpc/rpc-response'

let rejected = false

const rpcs: { [index: string]: (client: E2EClient, data: any, response: RPCResponse) => void } = {
  'addTwo': (client, data, response) => {
    client.rpc.provides.addTwo()
    response.send(data.numA + data.numB)
  },
  'double': (client, data, response) => {
    client.rpc.provides.double()
    response.send(data * 2)
  },
  'stringify': (client, data, response) => {
    client.rpc.provides.stringify()
    response.send(typeof data === 'object' ? JSON.stringify(data) : String(data))
  },
  'a-provide-b-request': (client, data, response) => {
    client.rpc.provides['a-provide-b-request']()
    response.send(data * 3)
  },
  'only-full-user-data': (client, data, response) => {
    client.rpc.provides['only-full-user-data']()
    response.send('ok')
  },
  'alwaysReject': (client, data, response) => {
    client.rpc.provides.alwaysReject()
    response.reject()
  },
  'alwaysError': (client, data, response) => {
    client.rpc.provides.alwaysError()
    response.error('always errors')
  },
  'neverRespond': (client) => {
    client.rpc.provides.neverRespond()
  },
  'clientBRejects': (client, data, response) => {
    client.rpc.provides.clientBRejects()
    if (client.name === 'B') {
      response.reject()
    } else {
      response.send(data.root * data.root)
    }
  },
  'deny': (client, data, response) => {
    // permissions always deny
  },
  'rejectOnce': (client, data, response) => {
    client.rpc.provides.rejectOnce(data)
    if (rejected) {
      response.send('ok')
      rejected = false
    } else {
      response.reject()
      rejected = true
    }
  }
}

const assert = {
  recievesResponse (clientExpression: string, rpc: string, data: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.calledOnce(client.rpc.callbacks[rpc])
      sinon.assert.calledWith(client.rpc.callbacks[rpc], null, JSON.parse(data).toString())
      client.rpc.callbacks[rpc].resetHistory()
    })
  },

  recievesResponseWithError (clientExpression: string, eventually: boolean, rpc: string, error: string, done: Function) {
    setTimeout(() => {
      clientHandler.getClients(clientExpression).forEach((client) => {
        sinon.assert.calledOnce(client.rpc.callbacks[rpc])
        sinon.assert.calledWith(client.rpc.callbacks[rpc], error)
        client.rpc.callbacks[rpc].resetHistory()
        done()
      })
    }, eventually ? 150 : 0)
  },

  providerCalled (clientExpression: string, rpc: string, timesCalled: number, data?: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.callCount(client.rpc.provides[rpc], timesCalled)
      if (data) {
        sinon.assert.calledWith(client.rpc.provides[rpc], JSON.parse(data))
      }
      client.rpc.provides[rpc].resetHistory()
    })
  }
}

export const rpc = {
  assert,

  provide (clientExpression: string, rpc: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.rpc.provides[rpc] = sinon.spy()
      client.client.rpc.provide(rpc, rpcs[rpc].bind(null, client))
    })
  },

  unprovide (clientExpression: string, rpc: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.rpc.unprovide(rpc)
    })
  },

  make (clientExpression: string, rpc: string, data: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const callback = client.rpc.callbacks[rpc] = sinon.spy()
      client.client.rpc.make(rpc, JSON.parse(data), (error: any, result: any) => {
        callback(error, result && result.toString())
      })
    })
  }
}

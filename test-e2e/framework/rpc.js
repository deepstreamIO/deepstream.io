'use strict'

const sinon = require('sinon')

const clientHandler = require('./client-handler')
const utils = require('./utils')

const rpcs = {
  addTwo: (client, data, response) => {
    client.rpc.provides.addTwo()
    response.send(data.numA + data.numB)
  },
  double: (client, data, response) => {
    client.rpc.provides.double()
    response.send(data * 2)
  },
  stringify: (client, data, response) => {
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
  alwaysReject: (client, data, response) => {
    client.rpc.provides.alwaysReject()
    response.reject()
  },
  neverRespond: (client) => {
    client.rpc.provides.neverRespond()
  },
  clientBRejects: (client, data, response) => {
    client.rpc.provides.clientBRejects()
    if (client.name === 'B') {
      response.reject()
    } else {
      response.send(data.root * data.root)
    }
  },
  deny: (client, data, response) => {
    // permissions always deny
  }
}

module.exports = {
  provide (clientExpression, rpc) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.rpc.provides[rpc] = sinon.spy()
      client.client.rpc.provide(rpc, rpcs[rpc].bind(null, client))
    })
  },

  unprovide (clientExpression, rpc, args, done) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.rpc.unprovide(rpc)
    })
  },

  make (clientExpression, rpc, args, done) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const callback = client.rpc.callbacks[rpc] = sinon.spy()
      client.client.rpc.make(rpc, JSON.parse(args), (a, b) => {
        callback(a, b && b.toString())
        setTimeout(done, utils.defaultDelay)
      })
    })
  }
}

module.exports.assert = {

  recievesResponse (clientExpression, rpc, data) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.calledOnce(client.rpc.callbacks[rpc])
      sinon.assert.calledWith(client.rpc.callbacks[rpc], null, JSON.parse(data).toString())
      client.rpc.callbacks[rpc].reset()
    })
  },

  recievesResponseWithError (clientExpression, eventually, rpc, error, done) {
    setTimeout(() => {
      clientHandler.getClients(clientExpression).forEach((client) => {
        sinon.assert.calledOnce(client.rpc.callbacks[rpc])
        sinon.assert.calledWith(client.rpc.callbacks[rpc], error)
        client.rpc.callbacks[rpc].reset()
        done()
      })
    }, eventually ? 150 : 0)
  },

  providerCalled (clientExpression, rpc, timesCalled) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.callCount(client.rpc.provides[rpc], timesCalled)
      client.rpc.provides[rpc].reset()
    })
  }
}

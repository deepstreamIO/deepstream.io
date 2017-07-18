'use strict'

const sinon = require('sinon')

const clientHandler = require('./client-handler')
const utils = require('./utils')

module.exports = function () {

  this.Given(/^(.+) ((?:un)?provides?) the RPC "([^"]*)"$/, (clientExpression, unprovides, rpc, done) => {
    const rpcs = {
      addTwo: (client, data, response) => {
        client.rpc.provides.addTwo()
        // console.log("addTwo called with data", data, "client", client);
        response.send(data.numA + data.numB)
      },
      double: (client, data, response) => {
        client.rpc.provides.double()
        response.send(data * 2)
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
      }
    }

    clientHandler.getClients(clientExpression).forEach((client) => {
      if (unprovides.match(/unprovide/)) {
        client.client.rpc.unprovide(rpc)
      } else {
        client.rpc.provides[rpc] = sinon.spy()
        client.client.rpc.provide(rpc, rpcs[rpc].bind(null, client))
      }
    })

    setTimeout(done, utils.defaultDelay)
  })

  this.When(/^(.+) calls? the RPC "([^"]*)" with arguments? ("[^"]*"|\d+|\{.*\})$/, (clientExpression, rpc, args, done) => {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const callback = client.rpc.callbacks[rpc] = sinon.spy()
      client.client.rpc.make(rpc, JSON.parse(args), (a, b) => {
        callback(a, b && b.toString())
        setTimeout(done, utils.defaultDelay)
      })
    })
  })

  this.Then(/(.+) receives? a response for RPC "([^"]*)" with data ("[^"]*"|\d+|\{.*\})$/, (clientExpression, rpc, data) => {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.calledOnce(client.rpc.callbacks[rpc])
      sinon.assert.calledWith(client.rpc.callbacks[rpc], null, JSON.parse(data).toString())
      client.rpc.callbacks[rpc].reset()
    })
  })

  this.Then(/(.+) (eventually )?receives? a response for RPC "([^"]*)" with error "([^"]*)"$/, (clientExpression, eventually, rpc, error, done) => {
    setTimeout(() => {
      clientHandler.getClients(clientExpression).forEach((client) => {
        sinon.assert.calledOnce(client.rpc.callbacks[rpc])
        sinon.assert.calledWith(client.rpc.callbacks[rpc], error)
        client.rpc.callbacks[rpc].reset()
        done()
      })
    }, eventually ? 150 : 0)
  })

  this.Then(/(.+) RPCs? "([^"]*)" (?:is|are) (never called|called (?:once|(\d+) times?))$/, (clientExpression, rpc, times, nTimes) => {
    let timesCalled
    if (times.match(/never/)) {
      timesCalled = 0
    } else if (times.match(/once/)) {
      timesCalled = 1
    } else {
      timesCalled = parseInt(nTimes, 10)
    }

    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.callCount(client.rpc.provides[rpc], timesCalled)
      client.rpc.provides[rpc].reset()
    })
  })

}

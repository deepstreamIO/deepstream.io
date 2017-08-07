/* eslint-disable max-len, new-cap, import/no-extraneous-dependencies, no-unused-expressions */
'use strict'

const expect = require('chai').expect
const sinon = require('sinon')
const needle = require('needle')

const clientHandler = require('../client/client-handler')
const utils = require('../client/utils')

let httpClients = {}

module.exports = function () {

  this.Given(/^(.+) authenticates? with http server (\d+)$/, (clientExpression, server, done) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      let serverUrl
      if (global.cluster.getAuthUrl) {
        serverUrl = global.cluster.getAuthUrl(server - 1, clientName)
      } else {
        serverUrl = global.cluster.getHttpUrl(server - 1, clientName)
      }
      const message = {
        username: clientName,
        password: 'abcdefgh'
      }
      needle.post(serverUrl, message, { json: true }, (err, response) => {
        process.nextTick(done)
        expect(err).to.be.null
        expect(response.statusCode).to.be.within(200, 299)
        expect(response.body.token).to.be.a('string')
        httpClients[clientName] = {
          token: response.body.token,
          serverUrl: global.cluster.getHttpUrl(server - 1, clientName),
          queue: [],
          lastResponse: Object.assign({}, response, { isAuthResponse: true }),
          resultChecked: false
        }
      })
    })
  })

  this.Given(/^(.+) authenticates? with http server (\d+) with details ("[^"]*"|\d+|\{.*\})?$/, (clientExpression, server, data, done) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      let serverUrl
      if (global.cluster.getAuthUrl) {
        serverUrl = global.cluster.getAuthUrl(server - 1, clientName)
      } else {
        serverUrl = global.cluster.getHttpUrl(server - 1, clientName)
      }
      const credentials = JSON.parse(data)
      needle.post(serverUrl, credentials, { json: true }, (err, response) => {
        process.nextTick(done)
        expect(err).to.be.null
        httpClients[clientName] = {
          token: response.body.token,
          serverUrl: global.cluster.getHttpUrl(server - 1, clientName),
          queue: [],
          lastResponse: Object.assign({}, response, { isAuthResponse: true }),
          resultChecked: false
        }
      })
    })
  })

  this.Then(/^the last response (.+) received contained the properties "([^"]*)"$/, (clientExpression, properties) => {
    const propertyArray = properties.split(',')
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = httpClients[clientName]
      expect(client.lastResponse.body).to.contain.keys(propertyArray)
      expect(Object.keys(client.lastResponse.body).length).to.equal(propertyArray.length)
      client.resultChecked = true
    })
  })

  this.When(/^(.+) queues? (?:an|the|"(\d+)") events? "([^"]*)"(?: with data ("[^"]*"|\d+|\{.*\}))?$/, (clientExpression, numEvents, eventName, rawData) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = httpClients[clientName]
      const jifMessage = {
        topic: 'event',
        action: 'emit',
        eventName,
      }
      if (rawData !== undefined) {
        const data = utils.parseData(rawData)
        jifMessage.data = data
      }
      if (numEvents === undefined) {
        client.queue.push(jifMessage)

      } else {
        for (let i = 0; i < numEvents; i++) {
          client.queue.push(jifMessage)
        }
      }
    })
  })

  this.When(/^(.+) sends the data ("[^"]*"|\d+|\{.*\})$/, (clientExpression, rawData, done) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = httpClients[clientName]
      needle.post(`${client.serverUrl}`, JSON.parse(rawData), { json: true }, (err, response) => {
        setTimeout(done, utils.defaultDelay)
        client.lastResponse = response
      })
    })
  })

  this.When(/^(.+) queues "(\d+)" random messages$/, (clientExpression, numMessages) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = httpClients[clientName]
      for (let i = 0; i < numMessages; i++) {
        const r = Math.random()
        let message
        if (r < 0.3) {
          message = {
            topic: 'event',
            action: 'emit',
            eventName: 'eventName'
          }
        } else if (r < 0.5) {
          message = {
            topic: 'record',
            action: 'read',
            recordName: 'recordName'
          }
        } else if (r < 0.6) {
          message = {
            topic: 'record',
            action: 'write',
            recordName: 'recordName',
            path: 'r',
            data: r
          }
        } else if (r < 0.7) {
          message = {
            topic: 'record',
            action: 'head',
            recordName: 'recordName',
          }
        } else if (r < 0.8) {
          message = {
            topic: 'rpc',
            action: 'make',
            rpcName: 'addTwo',
            data: {
              numA: (r * 1011) % 77,
              numB: (r * 9528) % 63
            }
          }
        } else {
          message = {
            topic: 'presence',
            action: 'query',
          }
        }

        client.queue.push(message)
      }
    })
  })

  this.When(/^(.+) queues a presence query$/, (clientExpression) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = httpClients[clientName]
      const jifMessage = {
        topic: 'presence',
        action: 'query'
      }

      client.queue.push(jifMessage)
    })
  })

  this.When(/^(.+) queues? (?:an|the) RPC call to "([^"]*)"(?: with arguments ("[^"]*"|\d+|\{.*\}))?$/, (clientExpression, rpcName, rawData) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = httpClients[clientName]
      const jifMessage = {
        topic: 'rpc',
        action: 'make',
        rpcName
      }
      if (rawData !== undefined) {
        const data = utils.parseData(rawData)
        jifMessage.data = data
      }

      client.queue.push(jifMessage)
    })
  })

  this.When(/^(.+) queues? a fetch for record "([^"]*)"$/, (clientExpression, recordName) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = httpClients[clientName]
      const jifMessage = {
        topic: 'record',
        action: 'read',
        recordName,
      }

      client.queue.push(jifMessage)
    })
  })

  this.When(/^(.+) queues? a write to record "([^"]*)"(?: and path "([^"]*)")? with data '([^']*)'(?: and version "(-?\d+)")?$/, (clientExpression, recordName, path, rawData, version) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = httpClients[clientName]
      const jifMessage = {
        topic: 'record',
        action: 'write',
        recordName,
      }
      if (path !== undefined) {
        jifMessage.path = path
      }
      if (rawData !== undefined) {
        const data = utils.parseData(rawData)
        jifMessage.data = data
      }
      if (version !== undefined) {
        jifMessage.version = parseInt(version, 10)
      }
      client.queue.push(jifMessage)
    })
  })

  this.When(/^(.+) queues? a delete for record "([^"]*)"$/, (clientExpression, recordName) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = httpClients[clientName]
      const jifMessage = {
        topic: 'record',
        action: 'delete',
        recordName,
      }

      client.queue.push(jifMessage)
    })
  })

  this.When(/^(.+) queues? a head for record "([^"]*)"$/, (clientExpression, recordName) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = httpClients[clientName]
      const jifMessage = {
        topic: 'record',
        action: 'head',
        recordName,
      }

      client.queue.push(jifMessage)
    })
  })

  this.When(/^(.+) flushe?s? their http queues?$/, (clientExpression, done) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = httpClients[clientName]
      const message = {
        token: client.token,
        body: client.queue
      }
      client.queue = []
      needle.post(`${client.serverUrl}`, message, { json: true }, (err, response) => {
        setTimeout(done, utils.defaultDelay)
        client.lastResponse = response
      })
    })
  })

  this.Then(/^(.+) last response said that clients? "([^"]*)" (?:is|are) connected(?: at index "(\d+)")?$/, (clientExpression, connectedClients, rawIndex) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const responseIndex = rawIndex === undefined ? 0 : rawIndex
      const client = httpClients[clientName]
      const lastResponse = client.lastResponse

      expect(lastResponse).to.not.be.null
      expect(lastResponse.body).to.be.an('object')
      expect(lastResponse.body.body).to.be.an('array')
      const result = lastResponse.body.body[responseIndex]
      expect(result).to.be.an('object')
      expect(result.success).to.be.true
      expect(result.users).to.have.members(connectedClients.split(','))
    })
  })

  this.Then(/^(.+) receives? an RPC response(?: with data ("[^"]*"|\d+|\{.*\}))?(?: at index "(\d+)")?$/, (clientExpression, rawData, rawIndex) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const responseIndex = rawIndex === undefined ? 0 : rawIndex
      const client = httpClients[clientName]
      const lastResponse = client.lastResponse

      expect(lastResponse).to.not.be.null
      expect(lastResponse.body).to.be.an('object')
      expect(lastResponse.body.body).to.be.an('array')
      const result = lastResponse.body.body[responseIndex]
      expect(result).to.be.an('object')
      expect(result.success).to.be.true
      if (rawData !== undefined) {
        expect(result.data).to.deep.equal(utils.parseData(rawData))
      }
    })
  })

  this.Then(/^(.+) receives? the record (?:head )?"([^"]*)"(?: with data '([^']+)')?(?: (?:with|and) version "(\d+)")?(?: at index "(\d+)")?$/, (clientExpression, recordName, rawData, version, rawIndex) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const responseIndex = rawIndex === undefined ? 0 : rawIndex
      const client = httpClients[clientName]
      const lastResponse = client.lastResponse

      expect(lastResponse).to.not.be.null
      expect(lastResponse.body).to.be.an('object')
      expect(lastResponse.body.body).to.be.an('array')
      const result = lastResponse.body.body[responseIndex]
      expect(result).to.be.an('object')
      expect(result.success).to.be.true
      if (rawData !== undefined) {
        expect(result.data).to.deep.equal(utils.parseData(rawData))
      }
      if (version !== undefined) {
        expect(result.version).to.equal(parseInt(version, 10))
      }
    })
  })

  this.Then(/^(.+) last response was a "(\S*)"(?: with length "(\d+)")?$/, (clientExpression, result, length) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = httpClients[clientName]
      const lastResponse = client.lastResponse

      const failures = client.lastResponse.body.body.filter(res => !res.success)
      const failuresStr = JSON.stringify(failures, null, 2)
      expect(lastResponse.body.result).to.equal(result, failuresStr)

      if (length !== undefined) {
        expect(lastResponse.body.body.length).to.equal(parseInt(length, 10))
      }

      // by default, clients are expected to have had a SUCCESS response last, so mark as already
      // checked
      client.resultChecked = true
    })
  })

  this.Then(/^(.+) (eventually )?receives "(\d+)" events? "([^"]*)"(?: with data (.+))?$/, (clientExpression, eventually, numEvents, subscriptionName, data, done) => {
    setTimeout(() => {
      clientHandler.getClients(clientExpression).forEach((client) => {
        const eventSpy = client.event.callbacks[subscriptionName]
        expect(eventSpy.callCount).to.equal(parseInt(numEvents, 10))
        sinon.assert.calledWith(eventSpy, utils.parseData(data))
        eventSpy.reset()
        done()
      })
    }, eventually ? 350 : 0)
  })

  this.Then(/^(.+) last response had a success(?: at index "(\d+)")?$/, (clientExpression, rawIndex) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const responseIndex = rawIndex === undefined ? 0 : rawIndex
      const client = httpClients[clientName]
      const lastResponse = client.lastResponse

      expect(lastResponse).to.not.be.null
      expect(lastResponse.body).to.be.an('object')
      expect(lastResponse.body.body).to.be.an('array')
      const result = lastResponse.body.body[responseIndex]

      expect(result).to.be.an('object')
      expect(result.success).to.be.true

      client.resultChecked = true
    })
  })

  this.Then(/^(.+) last response had an? "([^"]*)" error matching "([^"]*)"(?: at index "(\d+)")?$/, (clientExpression, topic, message, rawIndex) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const responseIndex = rawIndex === undefined ? 0 : rawIndex
      const client = httpClients[clientName]
      const lastResponse = client.lastResponse

      expect(lastResponse).to.not.be.null
      expect(lastResponse.body).to.be.an('object')
      expect(lastResponse.body.body).to.be.an('array')
      const result = lastResponse.body.body[responseIndex]

      expect(result).to.be.an('object')
      expect(result.success).to.be.false
      expect(result.errorTopic).to.equal(topic)
      expect(result.error).to.match(new RegExp(message, 'i'))

      client.resultChecked = true
    })
  })

  this.Then(/^(.+) last response had an error matching "([^"]*)"$/, (clientExpression, message) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = httpClients[clientName]
      const lastResponse = client.lastResponse
      console.log(lastResponse.body)
      expect(lastResponse).to.not.be.null
      expect(lastResponse.body).to.be.an('string')
      expect(lastResponse.body).to.match(new RegExp(message, 'i'))

      client.resultChecked = true
    })
  })

  this.After(() => {
    for (const clientName in httpClients) {
      const client = httpClients[clientName]
      if (client.lastResponse && !client.resultChecked && !client.lastResponse.isAuthResponse) {
        const failures = client.lastResponse.body.body.filter(res => !res.success)
        const failuresStr = JSON.stringify(failures, null, 2)
        expect(client.lastResponse.body.result).to.equal('SUCCESS', failuresStr)
      }
      client.lastResponse = null
    }
    httpClients = {}
  })

}

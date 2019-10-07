import * as sinon from 'sinon'
import {Given, When, Then, After } from 'cucumber'
import { expect } from 'chai'
import * as needle from 'needle'
import { parseData, defaultDelay } from '../../framework/utils'
const { clientHandler } = require(`../../framework${process.env.V3 ? '-v3' : ''}/client-handler`)

let httpClients: { [index: string]: any } = {}

Given(/^(.+) authenticates? with http server (\d+)$/, (clientExpression: string, server, done) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    let serverUrl
    if (global.e2eHarness.getAuthUrl) {
      serverUrl = global.e2eHarness.getAuthUrl(server)
    } else {
      serverUrl = global.e2eHarness.getHttpUrl(server)
    }
    const message = {
      username: clientName,
      password: 'abcdefgh'
    }

    needle.post(serverUrl, message, { json: true }, (err, response) => {
      process.nextTick(done)
      expect(err).to.equal(null)
      expect(response.statusCode).to.be.within(200, 299)
      expect(response.body.token).to.be.a('string')
      httpClients[clientName] = {
        token: response.body.token,
        serverUrl: global.e2eHarness.getHttpUrl(server - 1, clientName),
        queue: [],
        lastResponse: Object.assign({}, response, { isAuthResponse: true }),
        resultChecked: false
      }
    })
  })
})

Given(/^(.+) authenticates? with http server (\d+) with details ("[^"]*"|\d+|{.*})?$/, (clientExpression: string, server, data, done) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    let serverUrl
    if (global.e2eHarness.getAuthUrl) {
      serverUrl = global.e2eHarness.getAuthUrl(server - 1, clientName)
    } else {
      serverUrl = global.e2eHarness.getHttpUrl(server - 1, clientName)
    }
    const credentials = JSON.parse(data)
    needle.post(serverUrl, credentials, { json: true }, (err, response) => {
      process.nextTick(done)
      expect(err).to.equal(null)
      httpClients[clientName] = {
        token: response.body.token,
        serverUrl: global.e2eHarness.getHttpUrl(server - 1, clientName),
        queue: [],
        lastResponse: Object.assign({}, response, { isAuthResponse: true }),
        resultChecked: false
      }
    })
  })
})

Then(/^the last response (.+) received contained the properties "([^"]*)"$/, (clientExpression: string, properties) => {
  const propertyArray = properties.split(',')
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const client = httpClients[clientName]
    expect(client.lastResponse.body).to.contain.keys(propertyArray)
    expect(Object.keys(client.lastResponse.body).length).to.equal(propertyArray.length)
    client.resultChecked = true
  })
})

When(/^(.+) queues? (?:an|the|"(\d+)") events? "([^"]*)"(?: with data ("[^"]*"|\d+|{.*}))?$/, (clientExpression: string, numEvents, eventName, rawData) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const client = httpClients[clientName]
    const jifMessage = {
      topic: 'event',
      action: 'emit',
      eventName,
      data: undefined
    }
    if (rawData !== undefined) {
      jifMessage.data = parseData(rawData)
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

When(/^(.+) sends the data ("[^"]*"|\d+|{.*})$/, (clientExpression: string, rawData, done) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const client = httpClients[clientName]
    needle.post(`${client.serverUrl}`, JSON.parse(rawData), { json: true }, (err, response) => {
      setTimeout(done, defaultDelay)
      client.lastResponse = response
    })
  })
})

When(/^(.+) queues "(\d+)" random messages$/, (clientExpression: string, numMessages) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
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

When(/^(.+) queues a presence query$/, (clientExpression) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const client = httpClients[clientName]
    const jifMessage = {
      topic: 'presence',
      action: 'query'
    }

    client.queue.push(jifMessage)
  })
})

When(/^(.+) queues? (?:an|the) RPC call to "([^"]*)"(?: with arguments ("[^"]*"|\d+|{.*}))?$/, (clientExpression: string, rpcName, rawData) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const client = httpClients[clientName]
    const jifMessage = {
      topic: 'rpc',
      action: 'make',
      rpcName,
      data: undefined
    }
    if (rawData !== undefined) {
      jifMessage.data = parseData(rawData)
    }

    client.queue.push(jifMessage)
  })
})

When(/^(.+) queues? a fetch for (record|list) "([^"]*)"$/, (clientExpression: string, recordOrList, recordName) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const client = httpClients[clientName]
    const jifMessage = recordOrList === 'record'
      ? { topic: 'record', action: 'read', recordName }
      : { topic: 'list', action: 'read', listName: recordName }

    client.queue.push(jifMessage)
  })
})

When(/^(.+) queues? a write to (record|list) "([^"]*)"(?: and path "([^"]*)")? with data '([^']*)'(?: and version "(-?\d+)")?$/, (clientExpression: string, recordOrList, recordName, path, rawData, version) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const client = httpClients[clientName]
    const jifMessage = recordOrList === 'record'
      ? { topic: 'record', action: 'write', recordName }
      : { topic: 'list', action: 'write', listName: recordName }

    if (path !== undefined) {
      // @ts-ignore
      jifMessage.path = path
    }
    if (rawData !== undefined) {
      // @ts-ignore
      jifMessage.data = parseData(rawData)
    }
    if (version !== undefined) {
      // @ts-ignore
      jifMessage.version = parseInt(version, 10)
    }

    client.queue.push(jifMessage)
  })
})

When(/^(.+) queues? a notify for records? '([^"]*)'$/, (clientExpression: string, recordNames) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const client = httpClients[clientName]
    const jifMessage = { topic: 'record', action: 'notify', recordNames: recordNames.split(',') }
    client.queue.push(jifMessage)
  })
})

When(/^(.+) queues? a delete for (record|list) "([^"]*)"$/, (clientExpression: string, recordOrList, recordName) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const client = httpClients[clientName]
    const jifMessage = recordOrList === 'record'
      ? { topic: 'record', action: 'delete', recordName }
      : { topic: 'list', action: 'delete', listName: recordName }

    client.queue.push(jifMessage)
  })
})

When(/^(.+) queues? a head for record "([^"]*)"$/, (clientExpression: string, recordName: string) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const client = httpClients[clientName]
    const jifMessage = {
      topic: 'record',
      action: 'head',
      recordName,
    }

    client.queue.push(jifMessage)
  })
})

When(/^(.+) flushe?s? their http queues?$/, (clientExpression: string, done) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const client = httpClients[clientName]
    const message = {
      token: client.token,
      body: client.queue
    }
    client.queue = []
    needle.post(`${client.serverUrl}`, message, { json: true }, (err, response) => {
      setTimeout(done, defaultDelay)
      client.lastResponse = response
    })
  })
})

Then(/^(.+) last response said that clients? "([^"]*)" (?:is|are) connected(?: at index "(\d+)")?$/, (clientExpression: string, connectedClients, rawIndex) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const responseIndex = rawIndex === undefined ? 0 : rawIndex
    const client = httpClients[clientName]
    const lastResponse = client.lastResponse

    expect(lastResponse).not.to.equal(null)
    expect(lastResponse.body).to.be.an('object')
    expect(lastResponse.body.body).to.be.an('array')
    const result = lastResponse.body.body[responseIndex]
    expect(result).to.be.an('object')
    expect(result.success).to.equal(true)
    expect(result.users).to.have.members(connectedClients.split(','))
  })
})

Then(/^(.+) last response said that no clients are connected(?: at index "(\d+)")?$/, (clientExpression: string, rawIndex) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const responseIndex = rawIndex === undefined ? 0 : rawIndex
    const client = httpClients[clientName]
    const lastResponse = client.lastResponse

    expect(lastResponse).not.to.equal(null)
    expect(lastResponse.body).to.be.an('object')
    expect(lastResponse.body.body).to.be.an('array')
    const result = lastResponse.body.body[responseIndex]
    expect(result).to.be.an('object')
    expect(result.success).to.equal(true)
    expect(result.users).to.deep.equal([])
  })
})

Then(/^(.+) receives? an RPC response(?: with data ("[^"]*"|\d+|{.*}))?(?: at index "(\d+)")?$/, (clientExpression: string, rawData, rawIndex) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const responseIndex = rawIndex === undefined ? 0 : rawIndex
    const client = httpClients[clientName]
    const lastResponse = client.lastResponse

    expect(lastResponse).not.to.equal(null)
    expect(lastResponse.body).to.be.an('object')
    expect(lastResponse.body.body).to.be.an('array')
    const result = lastResponse.body.body[responseIndex]
    expect(result).to.be.an('object')
    expect(result.success).to.equal(true)
    if (rawData !== undefined) {
      expect(result.data).to.deep.equal(parseData(rawData))
    }
  })
})

Then(/^(.+) receives? the (?:record|list) (?:head )?"([^"]*)"(?: with data '([^']+)')?(?: (?:with|and) version "(\d+)")?(?: at index "(\d+)")?$/, (clientExpression: string, recordName: string, rawData, version, rawIndex) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const responseIndex = rawIndex === undefined ? 0 : rawIndex
    const client = httpClients[clientName]
    const lastResponse = client.lastResponse

    expect(lastResponse).not.to.equal(null)
    expect(lastResponse.body).to.be.an('object')
    expect(lastResponse.body.body).to.be.an('array')
    const result = lastResponse.body.body[responseIndex]
    expect(result).to.be.an('object')
    expect(result.success).to.equal(true)
    if (rawData !== undefined) {
      expect(result.data).to.deep.equal(parseData(rawData))
    }
    if (version !== undefined) {
      expect(result.version).to.equal(parseInt(version, 10))
    }
  })
})

Then(/^(.+) last response was a "(\S*)"(?: with length "(\d+)")?$/, (clientExpression: string, result, length) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const client = httpClients[clientName]
    const lastResponse = client.lastResponse

    const failures = client.lastResponse.body.body.filter((res: any) => !res.success)
    const failuresStr = JSON.stringify(failures, null, 2)
    expect(lastResponse.body.result).to.equal(result, failuresStr)

    if (length !== undefined) {
      expect(lastResponse.body.body.length).to.equal(parseInt(length, 10))
    }

      // by default, clients are expected to have a SUCCESS response last, so mark as already
      // checked
    client.resultChecked = true
  })
})

Then(/^(.+) (eventually )?receives "(\d+)" events? "([^"]*)"(?: with data (.+))?$/, (clientExpression: string, eventually, numEvents, subscriptionName, data, done) => {
  setTimeout(() => {
    clientHandler.getClients(clientExpression).forEach((client: any) => {
      const eventSpy = client.event.callbacks[subscriptionName]
      expect(eventSpy.callCount).to.equal(parseInt(numEvents, 10))
      sinon.assert.calledWith(eventSpy, parseData(data))
      eventSpy.resetHistory()
      done()
    })
  }, eventually ? 350 : 0)
})

Then(/^(.+) last response had a success(?: at index "(\d+)")?$/, (clientExpression: string, rawIndex) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const responseIndex = rawIndex === undefined ? 0 : rawIndex
    const client = httpClients[clientName]
    const lastResponse = client.lastResponse

    expect(lastResponse).not.to.equal(null)
    expect(lastResponse.body).to.be.an('object')
    expect(lastResponse.body.body).to.be.an('array')
    const result = lastResponse.body.body[responseIndex]

    expect(result).to.be.an('object')
    expect(result.success).to.equal(true)

    client.resultChecked = true
  })
})

Then(/^(.+) last response had an? "([^"]*)" error matching "([^"]*)"(?: at index "(\d+)")?$/, (clientExpression: string, topic: string, message: string, rawIndex: number) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const responseIndex = rawIndex === undefined ? 0 : rawIndex
    const client = httpClients[clientName]
    const lastResponse = client.lastResponse

    expect(lastResponse).not.to.equal(null)
    expect(lastResponse.body).to.be.an('object')
    expect(lastResponse.body.body).to.be.an('array')
    const result = lastResponse.body.body[responseIndex]

    expect(result).to.be.an('object')
    expect(result.success).to.equal(false)
    expect(result.errorTopic).to.equal(topic)
    expect(result.error).to.match(new RegExp(message, 'i'))

    client.resultChecked = true
  })
})

Then(/^(.+) last response had an error matching "([^"]*)"$/, (clientExpression: string, message) => {
  clientHandler.getClientNames(clientExpression).forEach((clientName: string) => {
    const client = httpClients[clientName]
    const lastResponse = client.lastResponse
    expect(lastResponse).not.to.equal(null)
    expect(lastResponse.body).to.be.an('string')
    expect(lastResponse.body).to.match(new RegExp(message, 'i'))

    client.resultChecked = true
  })
})

After(() => {
  for (const clientName in httpClients) {
    const client = httpClients[clientName]
    if (client.lastResponse && !client.resultChecked && !client.lastResponse.isAuthResponse) {
      const failures = client.lastResponse.body.body.filter((res: any) => !res.success)
      const failuresStr = JSON.stringify(failures, null, 2)
      expect(client.lastResponse.body.result).to.equal('SUCCESS', failuresStr)
    }
    client.lastResponse = null
  }
  httpClients = {}
})

'use strict'

const chai = require('chai') // eslint-disable-line
const sinon = require('sinon') // eslint-disable-line

const expect = chai.expect

const C = require('../../src/constants')

const JIFHandler = require('../../src/message/jif-handler').default
const LoggerMock = require('../test-mocks/logger-mock')

describe('JIF Handler', () => {
  let jifHandler
  const logger = new LoggerMock()
  beforeAll(() => {
    jifHandler = new JIFHandler({ logger })
  })
  describe('fromJIF', () => {

    it('should reject an empty message', () => {
      const jif = {}
      const result = jifHandler.fromJIF(jif)

      expect(result.success).to.be.false
      expect(result.error).to.be.a('string')
    })

    it('should reject a message that is not an object', () => {
      const jifs = [
        [{
          topic: 'event',
          eventName: 'time/berlin',
          action: 'emit',
          data: { a: ['b', 2] }
        }],
        '{"topic":"event","eventName":"time/berlin","action":"emit","data":{"a":["b",2]}}',
        23,
        null,
        undefined
      ]
      const results = jifs.map(jif => jifHandler.fromJIF(jif))

      results.forEach((result, i) => {
        expect(result.success).to.equal(false, i)
        expect(result.error).to.match(/should be object/, i)
      })
    })

    describe('events', () => {
      it('should create an event message for a well formed jit event', () => {
        const jif = {
          topic: 'event',
          eventName: 'time/berlin',
          action: 'emit',
          data: { a: ['b', 2] }
        }
        const result = jifHandler.fromJIF(jif)
        const message = result.message

        expect(result.done).to.be.true
        expect(result.success).to.be.true
        expect(message).to.be.an('object')
        expect(message.topic).to.equal(C.TOPIC.EVENT)
        expect(message.action).to.equal(C.EVENT_ACTIONS.EMIT)
        expect(message.name).to.equal('time/berlin')
        expect(message.parsedData).to.deep.equal({ a:['b', 2] })
      })

      it('should support events without payloads', () => {
        const jif = {
          topic: 'event',
          eventName: 'time/berlin',
          action: 'emit'
        }
        const result = jifHandler.fromJIF(jif)
        const message = result.message

        expect(result.success).to.be.true
        expect(message).to.be.an('object')
        expect(message.topic).to.equal(C.TOPIC.EVENT)
        expect(message.action).to.equal(C.EVENT_ACTIONS.EMIT)
        expect(message.name).to.equal('time/berlin')
        expect(message.parsedData).to.equal(undefined)
      })

      it('should reject malformed topics', () => {
        const topics = [
          null,
          23,
          ['event'],
          { event: 'event' },
          'evnt',
          'event ',
          'Event',
          'EVENT',
        ]
        const results = topics.map(topic => jifHandler.fromJIF(
          { topic, action: 'emit', eventName: 'time/berlin' }
        ))

        results.forEach((result, i) => expect(result.success).to.equal(false, i))
      })

      it('should reject malformed actions', () => {
        const actions = [
          null,
          23,
          'emi',
          'emit ',
          'Emit',
          'EMIT',
        ]
        const results = actions.map(action => jifHandler.fromJIF(
          { topic: 'event', action, eventName: 'time/berlin' }
        ))

        results.forEach((result, i) => expect(result.success).to.equal(false, i))
      })

      it('should not support an event without a name', () => {
        const jif = {
          topic: 'event',
          action: 'emit',
          data: ''
        }
        const result = jifHandler.fromJIF(jif)

        expect(result.success).to.be.false
        expect(result.error).to.be.a('string')
        expect(result.error).to.match(/eventName/)
      })

      it('should reject malformed names', () => {
        const names = [
          null,
          23,
          ['foo'],
          { name: 'john' },
          ''
        ]
        const results = names.map(eventName => jifHandler.fromJIF(
          { topic: 'event', action: 'emit', eventName }
        ))

        results.forEach((result, i) => expect(result.success).to.equal(false, i))
      })

    })

    describe('rpcs', () => {
      it('should handle a valid rpc message', () => {
        const jif = {
          topic: 'rpc',
          action: 'make',
          rpcName: 'add-two',
          data: { numA: 6, numB: 3 }
        }
        const result = jifHandler.fromJIF(jif)
        const message = result.message

        expect(result.done).to.be.false
        expect(result.success).to.be.true
        expect(message).to.be.an('object')
        expect(message.topic).to.equal(C.TOPIC.RPC)
        expect(message.action).to.equal(C.RPC_ACTIONS.REQUEST)
        expect(message.name).to.equal('add-two')
        expect(message.correlationId).to.be.a('string')
        expect(message.correlationId).to.have.length.above(12)
        expect(message.parsedData).to.deep.equal({ numA:6, numB:3 })
      })

      it('should handle an rpc without data', () => {
        const jif = {
          topic: 'rpc',
          action: 'make',
          rpcName: 'add-two',
        }
        const result = jifHandler.fromJIF(jif)
        const message = result.message

        expect(result.success).to.be.true
        expect(message).to.be.an('object')
        expect(message.topic).to.equal(C.TOPIC.RPC)
        expect(message.action).to.equal(C.RPC_ACTIONS.REQUEST)
        expect(message.name).to.equal('add-two')
        expect(message.correlationId).to.be.a('string')
        expect(message.correlationId).to.have.length.above(12)
        expect(message.parsedData).to.equal(undefined)
      })
    })

    describe('records', () => {
      it('should handle a record write (object type) without path', () => {
        const jif = {
          topic: 'record',
          action: 'write',
          recordName: 'car/bmw',
          data: { tyres: 2, wheels: 4 }
        }
        const result = jifHandler.fromJIF(jif)
        const message = result.message

        expect(result.success).to.be.true
        expect(message).to.be.an('object')
        expect(message.topic).to.equal(C.TOPIC.RECORD)
        expect(message.action).to.equal(C.RECORD_ACTIONS.CREATEANDUPDATE)
        expect(message.name).to.equal('car/bmw')
        expect(message.version).to.equal(-1)
        expect(message.parsedData).to.deep.equal({ tyres:2, wheels:4 })
        expect(message.isWriteAck).to.equal(true)
      })

      it('should handle a record write (array type) without path', () => {
        const jif = {
          topic: 'record',
          action: 'write',
          recordName: 'car/bmw',
          data: [{ model: 'M6', hp: 560 }, { model: 'X6', hp: 306 }]
        }
        const result = jifHandler.fromJIF(jif)
        const message = result.message

        expect(result.success).to.be.true
        expect(message).to.be.an('object')
        expect(message.topic).to.equal(C.TOPIC.RECORD)
        expect(message.action).to.equal(C.RECORD_ACTIONS.CREATEANDUPDATE)
        expect(message.name).to.equal('car/bmw')
        expect(message.version).to.equal(-1)
        expect(message.parsedData).to.deep.equal([{ model:'M6', hp:560 }, { model:'X6', hp:306 }])
        expect(message.isWriteAck).to.equal(true)
      })

      it('should handle a record write with path', () => {
        const jif = {
          topic: 'record',
          action: 'write',
          recordName: 'car/bmw',
          path: 'tyres',
          data: 3
        }
        const result = jifHandler.fromJIF(jif)
        const message = result.message

        expect(result.success).to.be.true
        expect(message).to.be.an('object')
        expect(message.topic).to.equal(C.TOPIC.RECORD)
        expect(message.action).to.equal(C.RECORD_ACTIONS.CREATEANDUPDATE)
        expect(message.name).to.equal('car/bmw')
        expect(message.version).to.equal(-1)
        expect(message.path).to.equal('tyres')
        expect(message.parsedData).to.deep.equal(3)
        expect(message.isWriteAck).to.equal(true)
      })

      it('should handle a record read', () => {
        const jif = {
          topic: 'record',
          action: 'read',
          recordName: 'car/bmw',
        }
        const result = jifHandler.fromJIF(jif)
        const message = result.message

        expect(result.success).to.be.true
        expect(message).to.be.an('object')
        expect(message.topic).to.equal(C.TOPIC.RECORD)
        expect(message.action).to.equal(C.RECORD_ACTIONS.READ)
        expect(message.name).to.equal('car/bmw')
      })

      it('should handle a record delete', () => {
        const jif = {
          topic: 'record',
          action: 'delete',
          recordName: 'car/bmw',
        }
        const result = jifHandler.fromJIF(jif)
        const message = result.message

        expect(result.success).to.be.true
        expect(message).to.be.an('object')
        expect(message.topic).to.equal(C.TOPIC.RECORD)
        expect(message.action).to.equal(C.RECORD_ACTIONS.DELETE)
        expect(message.name).to.equal('car/bmw')
      })

      it('should handle a record head', () => {
        const jif = {
          topic: 'record',
          action: 'head',
          recordName: 'car/bmw',
        }
        const result = jifHandler.fromJIF(jif)
        const message = result.message

        expect(result.success).to.be.true
        expect(message).to.be.an('object')
        expect(message.topic).to.equal(C.TOPIC.RECORD)
        expect(message.action).to.equal(C.RECORD_ACTIONS.HEAD)
        expect(message.name).to.equal('car/bmw')
      })

      it('should only allow writes to have a path field', () => {
        const jifs = [
          { topic: 'record', action: 'write', recordName: 'car/bmw', data: 'bla', path: 'wheel' },
          { topic: 'record', action: 'read', recordName: 'car/bmw', path: 'wheel' },
          { topic: 'record', action: 'head', recordName: 'car/bmw', path: 'wheel' },
          { topic: 'record', action: 'delete', recordName: 'car/bmw', path: 'wheel' }
        ]
        const results = jifs.map(jif => jifHandler.fromJIF(jif))

        expect(results[0].success).to.be.true
        expect(results[1].success).to.be.false
        expect(results[2].success).to.be.false
        expect(results[3].success).to.be.false
      })

      it('should only allow writes to have a data field', () => {
        const jifs = [
          { topic: 'record', action: 'write', recordName: 'car/bmw', data: { a: 123 } },
          { topic: 'record', action: 'read', recordName: 'car/bmw', data: { a: 123 } },
          { topic: 'record', action: 'head', recordName: 'car/bmw', data: { a: 123 } },
          { topic: 'record', action: 'delete', recordName: 'car/bmw', data: { a: 123 } }
        ]
        const results = jifs.map(jif => jifHandler.fromJIF(jif))

        expect(results[0].success).to.be.true
        expect(results[1].success).to.be.false
        expect(results[2].success).to.be.false
        expect(results[3].success).to.be.false
      })
    })

    describe('presence', () => {
      it('should handle a presence query', () => {
        const jif = {
          topic: 'presence',
          action: 'query'
        }
        const result = jifHandler.fromJIF(jif)
        const message = result.message

        expect(result.success).to.be.true
        expect(message).to.be.an('object')
        expect(message.topic).to.equal(C.TOPIC.PRESENCE)
        expect(message.action).to.equal(C.PRESENCE_ACTIONS.QUERY_ALL)
        expect(message.name).to.equal(C.PRESENCE_ACTIONS.QUERY_ALL.toString())
      })
    })
  })

  describe('toJIF', () => {
    describe('rpcs', () => {
      it('should build a valid rpc response', () => {
        const result = jifHandler.toJIF({
          topic: C.TOPIC.RPC,
          action: C.RPC_ACTIONS.RESPONSE,
          name: 'addTwo',
          correlationId: '1234',
          parsedData: 12
        })
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.have.all.keys(['success', 'data'])
        expect(jif.success).to.be.true
        expect(jif.data).to.equal(12)
      })
      it('should ignore an rpc request ack', () => {
        const result = jifHandler.toJIF({
          topic: C.TOPIC.RPC,
          action: C.RPC_ACTIONS.REQUEST,
          name: 'addTwo',
          correlationId: 1234,
          isAck: true
        })
        expect(result.done).to.be.false
      })

      it('should build a valid rpc response', () => {
        const result = jifHandler.toJIF({
          topic: C.TOPIC.RPC,
          action: C.RPC_ACTIONS.RESPONSE,
          name: 'addTwo',
          correlationId: 1234,
          parsedData: 12
        })
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.have.all.keys(['success', 'data'])
        expect(jif.success).to.be.true
        expect(jif.data).to.equal(12)
      })
    })

    describe('records', () => {
      it('should build a valid record write ack', () => {
        const result = jifHandler.toJIF({
          topic: C.TOPIC.RECORD,
          action: C.RECORD_ACTIONS.WRITE_ACKNOWLEDGEMENT,
          name: 'car/fiat',
          parsedData: [[2, 3], null]
        })
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.contain.keys(['success'])
        expect(jif.success).to.be.true
      })

      it('should build a valid record delete ack', () => {
        const result = jifHandler.toJIF({
          topic: C.TOPIC.RECORD,
          action: C.RECORD_ACTIONS.DELETE,
          name: 'car/fiat',
          isAck: true
        })
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.have.all.keys(['success'])
        expect(jif.success).to.be.true
      })

      it('should build a valid record read response', () => {
        const result = jifHandler.toJIF({
          topic: C.TOPIC.RECORD,
          action: C.RECORD_ACTIONS.READ_RESPONSE,
          name: 'car/fiat',
          version: 2,
          parsedData: { car: true }
        })
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.contain.keys(['success'])
        expect(jif.success).to.be.true
        expect(jif.data).to.deep.equal({ car: true })
        expect(jif.version).to.equal(2)
      })

      it('should handle a valid record head response', () => {
        const result = jifHandler.toJIF({
          topic: C.TOPIC.RECORD,
          action: C.RECORD_ACTIONS.HEAD_RESPONSE,
          name: 'car/fiat',
          version: 2
        })
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.have.all.keys(['success', 'version'])
        expect(jif.success).to.be.true
        expect(jif.version).to.equal(2)
      })

      it('should handle a valid record head error', () => {
        const result = jifHandler.errorToJIF({
          topic: C.TOPIC.RECORD,
          action: C.RECORD_ACTIONS.HEAD,
          name: 'car/fiat'
        }, C.EVENT.RECORD_LOAD_ERROR)
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.include.all.keys(['error', 'errorEvent', 'errorTopic', 'success'])
        expect(jif.success).to.be.false
        expect(jif.errorTopic).to.equal('record')
        expect(jif.errorEvent).to.equal(C.EVENT.RECORD_LOAD_ERROR)
        expect(jif.errorParams).to.equal('car/fiat') // TODO: review
      })
    })

    describe('presence', () => {
      it('should build a valid presence response', () => {
        const result = jifHandler.toJIF({
          topic: C.TOPIC.PRESENCE,
          action: C.PRESENCE_ACTIONS.QUERY_ALL_RESPONSE,
          parsedData: ['john', 'alex', 'yasser']
        })
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.have.all.keys(['success', 'users'])
        expect(jif.success).to.be.true
        expect(jif.users).to.deep.equal(['john', 'alex', 'yasser'])
      })
    })
  })

})

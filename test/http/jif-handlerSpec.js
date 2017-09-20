'use strict'

/* global describe, beforeAll, it */
/* eslint-disable no-unused-expressions */
const chai = require('chai') // eslint-disable-line
const proxyquire = require('proxyquire') // eslint-disable-line
const sinon = require('sinon') // eslint-disable-line

const expect = chai.expect

const C = require('../../src/constants/constants')
const MessageBuilder = require('../../src/message/message-builder')
const MessageParser = require('../../src/message/message-parser')
const msg = require('../test-helper/test-helper').msg

const JIFHandler = require('../../src/message/jif-handler')
const LoggerMock = require('../mocks/logger-mock')

describe('JIF Handler', () => {
  let jifHandler
  const logger = new LoggerMock()
  const jifHandlerOptions = {
    logger,
    constants: C,
    toTyped: MessageBuilder.typed,
    convertTyped: MessageParser.convertTyped,
    buildMessage: MessageBuilder.getMsg
  }
  beforeAll(() => {
    jifHandler = new JIFHandler(jifHandlerOptions)
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
        expect(message.action).to.equal(C.ACTIONS.EVENT)
        expect(message.data).to.deep.equal(['time/berlin', `${C.TYPES.OBJECT}{"a":["b",2]}`])
        expect(message.raw).to.equal(msg('E|EVT|time/berlin|O{"a":["b",2]}+'))
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
        expect(message.raw).to.be.a('string')
        expect(message.topic).to.equal(C.TOPIC.EVENT)
        expect(message.action).to.equal(C.ACTIONS.EVENT)
        expect(message.data).to.deep.equal(['time/berlin', C.TYPES.UNDEFINED])
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
        expect(message.action).to.equal(C.ACTIONS.REQUEST)
        expect(message.data[0]).to.equal('add-two')
        expect(message.data[1]).to.be.a('string')
        expect(message.data[1]).to.have.length.above(12)
        expect(message.data[2]).to.equal(`${C.TYPES.OBJECT}{"numA":6,"numB":3}`)
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
        expect(message.action).to.equal(C.ACTIONS.REQUEST)
        expect(message.data[0]).to.equal('add-two')
        expect(message.data[1]).to.be.a('string')
        expect(message.data[1]).to.have.length.above(12)
        expect(message.data[2]).to.equal(C.TYPES.UNDEFINED)
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
        expect(message.action).to.equal(C.ACTIONS.CREATEANDUPDATE)
        expect(message.data).to.deep.equal(
          ['car/bmw', -1, '{"tyres":2,"wheels":4}', '{"writeSuccess":true}']
        )
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
        expect(message.action).to.equal(C.ACTIONS.CREATEANDUPDATE)
        expect(message.data).to.deep.equal(
          ['car/bmw', -1, '[{"model":"M6","hp":560},{"model":"X6","hp":306}]', '{"writeSuccess":true}']
        )
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
        expect(message.action).to.equal(C.ACTIONS.CREATEANDUPDATE)
        expect(message.data).to.deep.equal(
          ['car/bmw', -1, 'tyres', `${C.TYPES.NUMBER}3`, '{"writeSuccess":true}']
        )
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
        expect(message.action).to.equal(C.ACTIONS.SNAPSHOT)
        expect(message.data).to.deep.equal(['car/bmw'])
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
        expect(message.action).to.equal(C.ACTIONS.DELETE)
        expect(message.data).to.deep.equal(['car/bmw'])
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
        expect(message.action).to.equal(C.ACTIONS.HEAD)
        expect(message.data).to.deep.equal(['car/bmw'])
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
        expect(message.action).to.equal(C.ACTIONS.QUERY)
        expect(message.data).to.deep.equal([C.ACTIONS.QUERY])
      })
    })
  })

  describe('toJIF', () => {
    describe('rpcs', () => {
      it('should build a valid rpc response', () => {
        const topic = C.TOPIC.RPC
        const action = C.ACTIONS.RESPONSE
        const data = ['addTwo', '1234', 'N12']
        const result = jifHandler.toJIF(topic, action, data)
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.have.all.keys(['success', 'data'])
        expect(jif.success).to.be.true
        expect(jif.data).to.equal(12)
      })
      it('should ignore an rpc request ack', () => {
        const topic = C.TOPIC.RPC
        const action = C.ACTIONS.ACK
        const data = [C.ACTIONS.REQUEST, 'addTwo', '1234']
        const result = jifHandler.toJIF(topic, action, data)
        expect(result.done).to.be.false
      })

      it('should build a valid rpc response', () => {
        const topic = C.TOPIC.RPC
        const action = C.ACTIONS.RESPONSE
        const data = ['addTwo', '1234', 'N12']
        const result = jifHandler.toJIF(topic, action, data)
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
        const topic = C.TOPIC.RECORD
        const action = C.ACTIONS.WRITE_ACKNOWLEDGEMENT
        const data = ['car/fiat', '[2,3]', C.TYPES.NULL]
        const result = jifHandler.toJIF(topic, action, data)
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.contain.keys(['success'])
        expect(jif.success).to.be.true
      })

      it('should build a valid record delete ack', () => {
        const topic = C.TOPIC.RECORD
        const action = C.ACTIONS.ACK
        const data = [C.ACTIONS.DELETE, 'car/fiat']
        const result = jifHandler.toJIF(topic, action, data)
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.have.all.keys(['success'])
        expect(jif.success).to.be.true
      })

      it('should build a valid record read response', () => {
        const topic = C.TOPIC.RECORD
        const action = C.ACTIONS.WRITE_ACKNOWLEDGEMENT
        const data = ['car/fiat', '[2,3]', C.TYPES.NULL]
        const result = jifHandler.toJIF(topic, action, data)
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.contain.keys(['success'])
        expect(jif.success).to.be.true

      })

      it('should handle a valid record head response', () => {
        const topic = C.TOPIC.RECORD
        const action = C.ACTIONS.HEAD
        const data = ['car/fiat', '2']
        const result = jifHandler.toJIF(topic, action, data)
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.have.all.keys(['success', 'version'])
        expect(jif.success).to.be.true
        expect(jif.version).to.equal(2)

      })

      it('should handle a valid record head error', () => {
        const topic = C.TOPIC.RECORD
        const type = C.ACTIONS.HEAD
        const message = ['car/fiat', C.EVENT.RECORD_LOAD_ERROR]
        const result = jifHandler.errorToJIF(topic, type, message)
        const jif = result.message
        expect(result.done).to.be.true
        expect(jif).to.be.an('object')
        expect(jif).to.include.all.keys(['error', 'errorEvent', 'errorTopic', 'success'])
        expect(jif.success).to.be.false
        expect(jif.errorTopic).to.equal('record')
        expect(jif.errorEvent).to.equal(C.ACTIONS.HEAD)
        expect(jif.errorParams).to.contain(C.EVENT.RECORD_LOAD_ERROR)
      })
    })

    describe('presence', () => {
      it('should build a valid presence response', () => {
        const topic = C.TOPIC.PRESENCE
        const action = C.ACTIONS.QUERY
        const data = ['john', 'alex', 'yasser']
        const result = jifHandler.toJIF(topic, action, data)
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

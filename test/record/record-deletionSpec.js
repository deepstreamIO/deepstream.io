/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const RecordDeletion = require('../../src/record/record-deletion')
const SocketWrapper = require('../mocks/socket-wrapper-mock')
const SocketMock = require('../mocks/socket-mock')
const msg = require('../test-helper/test-helper').msg
const LoggerMock = require('../mocks/logger-mock')

const deletionMsg = { topic: 'R', action: 'D', data: ['someRecord'] }

const getOptions = function () {
  return {
    storage: { delete: jasmine.createSpy('storage.delete') },
    cache: { delete: jasmine.createSpy('storage.cache') },
    cacheRetrievalTimeout: 1000,
    storageRetrievalTimeout: 1000,
    logger: new LoggerMock()
  }
}

describe('deletes records - happy path', () => {
  let recordDeletion
  const options = getOptions()
  const sender = new SocketWrapper(new SocketMock(), options)
  const successCallback = jasmine.createSpy('successCallback')

  it('creates the record deletion', () => {
    expect(options.cache.delete).not.toHaveBeenCalled()
    expect(options.storage.delete).not.toHaveBeenCalled()
    recordDeletion = new RecordDeletion(options, sender, deletionMsg, successCallback)
    expect(options.cache.delete.calls.argsFor(0)[0]).toBe('someRecord')
    expect(options.storage.delete.calls.argsFor(0)[0]).toBe('someRecord')
  })

  it('receives a synchronous response from cache', () => {
    expect(recordDeletion._isDestroyed).toBe(false)
    expect(successCallback).not.toHaveBeenCalled()
    options.cache.delete.calls.argsFor(0)[1](null)
  })

  it('receives a synchronous response from storage that completes the recordDeletion', () => {
    expect(recordDeletion._isDestroyed).toBe(false)
    expect(successCallback).not.toHaveBeenCalled()
    expect(sender.socket.lastSendMessage).toBe(null)
    options.storage.delete.calls.argsFor(0)[1](null)
    expect(sender.socket.lastSendMessage).toBe(msg('R|A|D|someRecord+'))
    expect(recordDeletion._isDestroyed).toBe(true)
    expect(successCallback).toHaveBeenCalled()
  })
})

describe('encounters an error during record deletion', () => {
  let recordDeletion
  const options = getOptions()
  const sender = new SocketWrapper(new SocketMock(), options)
  const successCallback = jasmine.createSpy('successCallback')

  it('creates the record deletion', () => {
    expect(options.cache.delete).not.toHaveBeenCalled()
    expect(options.storage.delete).not.toHaveBeenCalled()
    recordDeletion = new RecordDeletion(options, sender, deletionMsg, successCallback)
    expect(options.cache.delete.calls.argsFor(0)[0]).toBe('someRecord')
    expect(options.storage.delete.calls.argsFor(0)[0]).toBe('someRecord')
  })

  it('receives an error from the cache', () => {
    expect(recordDeletion._isDestroyed).toBe(false)
    expect(successCallback).not.toHaveBeenCalled()
    options.cache.delete.calls.argsFor(0)[1]('an error')
    expect(recordDeletion._isDestroyed).toBe(true)
    expect(successCallback).not.toHaveBeenCalled()
    expect(sender.socket.lastSendMessage).toBe(msg('R|E|RECORD_DELETE_ERROR|an error+'))
    expect(options.logger.log.calls.argsFor(0)).toEqual([3, 'RECORD_DELETE_ERROR', 'an error'])
  })

  it('receives a confirmation from storage after an error has occured', () => {
    expect(recordDeletion._isDestroyed).toBe(true)
    options.storage.delete.calls.argsFor(0)[1](null)
  })
})

describe('doesn\'t delete excluded messages from storage', () => {
  let recordDeletion
  const anotherDeletionMsg = { topic: 'R', action: 'D', data: ['no-storage/1'] }
  const options = getOptions()
  options.storageExclusion = new RegExp('no-storage/')
  const sender = new SocketWrapper(new SocketMock(), options)
  const successCallback = jasmine.createSpy('successCallback')

  it('creates the record deletion', () => {
    expect(options.cache.delete).not.toHaveBeenCalled()
    expect(options.storage.delete).not.toHaveBeenCalled()

    recordDeletion = new RecordDeletion(options, sender, anotherDeletionMsg, successCallback)

    expect(options.cache.delete.calls.argsFor(0)[0]).toBe('no-storage/1')
    expect(options.storage.delete).not.toHaveBeenCalled()
  })

  it('receives a response from cache that completes the recordDeletion', () => {
    expect(recordDeletion._isDestroyed).toBe(false)
    expect(successCallback).not.toHaveBeenCalled()
    expect(sender.socket.lastSendMessage).toBe(null)

    options.cache.delete.calls.argsFor(0)[1](null)

    expect(sender.socket.lastSendMessage).toBe(msg('R|A|D|no-storage/1+'))
    expect(recordDeletion._isDestroyed).toBe(true)
    expect(successCallback).toHaveBeenCalled()
  })
})

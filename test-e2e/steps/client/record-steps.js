'use strict'

const sinon = require('sinon')

const utils = require('./utils')

const cucumber = require('cucumber')
const When = cucumber.When
const Then = cucumber.Then
const Given = cucumber.Given

const record = require('../../framework/record')

When(/(.+) gets? the record "([^"]*)"$/, (clientExpression, recordName, done) => {
  record.getRecord(clientExpression, recordName)
  setTimeout(done, utils.defaultDelay)
})

When(/(.+) sets the merge strategy to (remote|local)$/, (clientExpression, recordName) => {
  // not implemented
})

Then(/^(.+) gets? notified of record "([^"]*)" getting (discarded|deleted)$/, (clientExpression, recordName, action) => {
  if (action === 'discarded') {
    record.assert.discarded(clientExpression, recordName)
  } else {
    record.assert.deleted(clientExpression, recordName)
  }
})

Then(/^(.+) receives? an update for record "([^"]*)" with data '([^']+)'$/, record.assert.recievedUpdate)

Then(/^(.+) receives? an update for record "([^"]*)" and path "([^"]*)" with data '([^']+)'$/, record.assert.recievedUpdateForPath)

Then(/^(.+) (?:don't|doesn't|does not) receive an update for record "([^"]*)"$/, record.assert.recievedNoUpdate)

Then(/^(.+) don't receive an update for record "([^"]*)" and path "([^"]*)"$/, record.assert.recievedNoUpdateForPath)

Given(/^(.+) subscribes? to record "([^"]*)"( with immediate flag)?$/, record.subscribe)

Given(/^(.+) unsubscribes? to record "([^"]*)"$/, record.unsubscribe)

Given(/^(.+) subscribes? to record "([^"]*)" with path "([^"]*)"( with immediate flag)?$/, record.subscribeWithPath)
Given(/^(.+) unsubscribes? to record "([^"]*)" with path "([^"]*)"$/, record.unsubscribeFromPath)

Then(/^(.+) (?:have|has) record "([^"]*)" with data '([^']+)'$/, record.assert.hasData)

Then(/^(.+) (?:have|has) record "([^"]*)" with path "([^"]*)" and data '([^']+)'$/, record.assert.hasDataAtPath)

Given(/^(.+) discards record "([^"]*)"$/, (clientExpression, recordName, done) => {
  record.discard(clientExpression, recordName)
  setTimeout(done, utils.defaultDelay)
})

Given(/^(.+) deletes record "([^"]*)"$/, (clientExpression, recordName, done) => {
  record.delete(clientExpression, recordName)
  setTimeout(done, utils.defaultDelay)
})

When(/^(.+) requires? write acknowledgements for record "([^"]*)"$/, (clientExpression, recordName) => {
  record.setupWriteAck(clientExpression, recordName)
})

When(/^(.+) sets? the record "([^"]*)" with data '([^']+)'$/, (clientExpression, recordName, data, done) => {
  record.set(clientExpression, recordName, data)
  setTimeout(done, utils.defaultDelay)
})

When(/^(.+) sets? the record "([^"]*)" without being subscribed with data '([^']+)'$/, (clientExpression, recordName, data, done) => {
  record.setData(clientExpression, recordName, data)
  setTimeout(done, utils.defaultDelay)
})

When(/^(.+) sets? the record "([^"]*)" without being subscribed with data '([^']+)' and requires write acknowledgement$/, (clientExpression, recordName, data, done) => {
  record.setDataWithWriteAck(clientExpression, recordName, data)
  setTimeout(done, utils.defaultDelay)
})

When(
    /^(.+) sets? the record "([^"]*)" without being subscribed with path "([^"]*)" and data '([^']+)'$/,
(clientExpression, recordName, path, data, done) => {
  record.setDataWithPath(clientExpression, recordName, path, data)
  setTimeout(done, utils.defaultDelay)
})

When(/^(.+) sets? the record "([^"]*)" and path "([^"]*)" with data '([^']+)'$/, (clientExpression, recordName, path, data, done) => {
  record.setWithPath(clientExpression, recordName, path, data)
  setTimeout(done, utils.defaultDelay)
})

Then(/^(.+) is told that the record "([^"]*)" was set without error$/, record.assert.writeAckSuccess)

Then(/^(.+) is told that the record "([^"]*)" experienced error "([^"]*)" while setting$/, (clientExpression, recordName, errorMessage, done) => {
  setTimeout(() => {
    record.assert.writeAckError(clientExpression, recordName, errorMessage)
    done()
  }, 100)
})

Given(/^(.+) requests? a snapshot of record "([^"]*)"$/, (clientExpression, recordName, done) => {
  record.snapshot(clientExpression, recordName)
  setTimeout(done, utils.defaultDelay)
})

Then(/^(.+) gets? a snapshot response for "([^"]*)" with data '([^']+)'$/, record.assert.snapshotSuccess)
Then(/^(.+) gets? a snapshot response for "([^"]*)" with error '([^']+)'$/, record.assert.snapshotError)

Given(/^(.+) asks? if record "([^"]*)" exists$/, (clientExpression, recordName, done) => {
  record.has(clientExpression, recordName)
  setTimeout(done, utils.defaultDelay)
})

Then(/^(.+) gets? told record "([^"]*)" (.*)exists?$/, (clientExpression, recordName, adjective) => {
  record.assert.has(clientExpression, recordName, adjective.indexOf('not') === -1)
})

Then(/^(.+) asks? for the version of record "([^"]*)"$/, (clientExpression, recordName, done) => {
  record.head(clientExpression, recordName)
  setTimeout(done, utils.defaultDelay)
})

Then(/^(.+) gets? told record "([^"]*)" has version (.*)$/, (clientExpression, recordName, version) => {
  record.assert.headSuccess(clientExpression, recordName, Number(version))
})
Then(/^(.+) gets? a head response for "([^"]*)" with error '([^']+)'$/, record.assert.headError)


  /** ******************************************************************************************************************************
   *********************************************************** Lists ************************************************************
   ********************************************************************************************************************************/

When(/(.+) gets? the list "([^"]*)"$/, (clientExpression, listName, done) => {
  record.getList(clientExpression, listName)
  setTimeout(done, utils.defaultDelay)
})

Given(/^(.+) sets the entries on the list "([^"]*)" to '([^']*)'$/, (clientExpression, listName, data, done) => {
  record.setEntries(clientExpression, listName, data)
  setTimeout(done, utils.defaultDelay)
})

Given(/^(.+) (adds|removes) an entry "([^"]*)" (?:to|from) "([^""]*)"$/, (clientExpression, action, entryName, listName, done) => {
  if (action === 'adds') {
    record.addEntry(clientExpression, listName, entryName)
  } else {
    record.removeEntry(clientExpression, listName, entryName)
  }
  setTimeout(done, utils.defaultDelay)
})


Then(/^(.+) have a list "([^"]*)" with entries '([^']*)'$/, record.assert.hasEntries)

Then(/^(.+) gets? notified of "([^"]*)" being (added|removed|moved) (?:to|in|from) "([^""]*)"$/, (clientExpression, entryName, action, listName) => {
  if (action === 'added') {
    record.assert.addedNotified(clientExpression, listName, entryName)
  } else if (action === 'removed') {
    record.assert.removedNotified(clientExpression, listName, entryName)
  } else {
    record.assert.movedNotified(clientExpression, listName, entryName)
  }
})

Then(/^(.+) gets? notified of list "([^"]*)" entries changing to '([^']*)'$/, record.assert.listChanged)

  /** ******************************************************************************************************************************
   *********************************************************** ANONYMOUS RECORDS ************************************************************
   ********************************************************************************************************************************/

When(/(.+) gets? a anonymous record$/, record.getAnonymousRecord)

When(/(.+) sets? the underlying record to "([^"]*)" on the anonymous record$/, (clientExpression, recordName, done) => {
  record.setName(clientExpression, recordName)
  setTimeout(done, utils.defaultDelay)
})

Then(/(.+) anonymous record data is '([^']*)'$/, (clientExpression, data) => {
  record.assert.anonymousRecordContains(clientExpression, data)
})


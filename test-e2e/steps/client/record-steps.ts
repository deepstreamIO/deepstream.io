import { defaultDelay } from '../../framework/utils'
import {When, Then, Given} from 'cucumber'
import { record } from '../../framework/record'

When(/(.+) gets? the record "([^"]*)"$/, (clientExpression: string, recordName: string, done) => {
  record.getRecord(clientExpression, recordName)
  setTimeout(done, defaultDelay * 3)
})

When(/(.+) sets the merge strategy to (remote|local)$/, (clientExpression: string, recordName: string) => {
  // not implemented
})

Then(/^(.+) (gets?|is not) notified of record "([^"]*)" getting (discarded|deleted)$/, (clientExpression: string, notified, recordName, action) => {
  const called = notified.indexOf('is not') !== -1 ? false : true
  if (action === 'discarded') {
    record.assert.discarded(clientExpression, recordName, called)
  } else {
    record.assert.deleted(clientExpression, recordName, called)
  }
})

Then(/^(.+) receives? an? "([^"]*)" error on record "([^"]*)"$/, record.assert.receivedRecordError)

Then(/^(.+) receives? an update for record "([^"]*)" with data '([^']+)'$/, record.assert.recievedUpdate)

Then(/^(.+) receives? an update for record "([^"]*)" and path "([^"]*)" with data '([^']+)'$/, record.assert.recievedUpdateForPath)

Then(/^(.+) (?:don't|doesn't|does not) receive an update for record "([^"]*)"$/, record.assert.recievedNoUpdate)

Then(/^(.+) don't receive an update for record "([^"]*)" and path "([^"]*)"$/, record.assert.recievedNoUpdateForPath)

Given(/^(.+) subscribes? to record "([^"]*)"( with immediate flag)?$/, record.subscribe)

Given(/^(.+) unsubscribes? to record "([^"]*)"$/, record.unsubscribe)

Given(/^(.+) subscribes? to record "([^"]*)" with path "([^"]*)"( with immediate flag)?$/, record.subscribeWithPath)
Given(/^(.+) unsubscribes? to record "([^"]*)" with path "([^"]*)"$/, record.unsubscribeFromPath)

Then(/^(.+) (?:have|has) record "([^"]*)" with data '([^']+)'$/, record.assert.hasData)

Then(/^(.+) (?:have|has) record "([^"]*)" with(out)? providers$/, record.assert.hasProviders)

Then(/^(.+) (?:have|has) record "([^"]*)" with path "([^"]*)" and data '([^']+)'$/, record.assert.hasDataAtPath)

Given(/^(.+) discards record "([^"]*)"$/, (clientExpression: string, recordName: string, done) => {
  record.discard(clientExpression, recordName)
  setTimeout(done, defaultDelay)
})

Given(/^(.+) deletes record "([^"]*)"$/, (clientExpression: string, recordName: string, done) => {
  record.delete(clientExpression, recordName)
  setTimeout(done, defaultDelay)
})

When(/^(.+) requires? write acknowledgements for record "([^"]*)"$/, (clientExpression: string, recordName: string) => {
  record.setupWriteAck(clientExpression, recordName)
})

When(/^(.+) sets? the record "([^"]*)" with data '([^']+)'$/, (clientExpression: string, recordName: string, data: string, done) => {
  record.set(clientExpression, recordName, data)
  setTimeout(done, defaultDelay)
})

When(/^(.+) sets? the record "([^"]*)" without being subscribed with data '([^']+)'$/, (clientExpression: string, recordName: string, data: string, done) => {
  record.setData(clientExpression, recordName, data)
  setTimeout(done, defaultDelay)
})

When(/^(.+) sets? the record "([^"]*)" without being subscribed with data '([^']+)' and requires write acknowledgement$/, (clientExpression: string, recordName: string, data: string, done) => {
  record.setDataWithWriteAck(clientExpression, recordName, data)
  setTimeout(done, defaultDelay)
})

When(
    /^(.+) sets? the record "([^"]*)" without being subscribed with path "([^"]*)" and data '([^']+)'$/,
(clientExpression: string, recordName: string, path, data, done) => {
  record.setDataWithPath(clientExpression, recordName, path, data)
  setTimeout(done, defaultDelay)
})

When(/^(.+) sets? the record "([^"]*)" and path "([^"]*)" with data '([^']+)'$/, (clientExpression: string, recordName: string, path, data, done) => {
  record.setWithPath(clientExpression, recordName, path, data)
  setTimeout(done, defaultDelay)
})

When(/^(.+) erases the path "([^"]*)" on record "([^"]*)"$/, (clientExpression: string, path, recordName, done) => {
  record.erase(clientExpression, recordName, path)
  setTimeout(done, defaultDelay)
})

Then(/^(.+) is told that the record "([^"]*)" was set without error$/, record.assert.writeAckSuccess)

Then(/^(.+) is told that the record "([^"]*)" experienced error "([^"]*)" while setting$/, (clientExpression: string, recordName: string, errorMessage, done) => {
  setTimeout(() => {
    record.assert.writeAckError(clientExpression, recordName, errorMessage)
    done()
  }, 100)
})

Given(/^(.+) requests? a snapshot of record "([^"]*)"$/, (clientExpression: string, recordName: string, done) => {
  record.snapshot(clientExpression, recordName)
  setTimeout(done, defaultDelay)
})

Then(/^(.+) gets? a snapshot response for "([^"]*)" with data '([^']+)'$/, record.assert.snapshotSuccess)
Then(/^(.+) gets? a snapshot response for "([^"]*)" with error '([^']+)'$/, record.assert.snapshotError)

Given(/^(.+) asks? if record "([^"]*)" exists$/, (clientExpression: string, recordName: string, done) => {
  record.has(clientExpression, recordName)
  setTimeout(done, defaultDelay)
})

Then(/^(.+) gets? told record "([^"]*)" (.*)exists?$/, (clientExpression: string, recordName: string, adjective) => {
  record.assert.has(clientExpression, recordName, adjective.indexOf('not') === -1)
})

Then(/^(.+) asks? for the version of record "([^"]*)"$/, (clientExpression: string, recordName: string, done) => {
  record.head(clientExpression, recordName)
  setTimeout(done, defaultDelay)
})

Then(/^(.+) gets? told record "([^"]*)" has version (.*)$/, (clientExpression: string, recordName: string, version: string) => {
  record.assert.headSuccess(clientExpression, recordName, Number(version))
})

Then(/^(.+) gets? a head response for "([^"]*)" with error '([^']+)'$/, record.assert.headError)

  /** ******************************************************************************************************************************
   *********************************************************** Lists ************************************************************
   ********************************************************************************************************************************/

When(/(.+) gets? the list "([^"]*)"$/, (clientExpression: string, listName, done) => {
  record.getList(clientExpression, listName)
  setTimeout(done, defaultDelay * 3)
})

Given(/^(.+) sets the entries on the list "([^"]*)" to '([^']*)'$/, (clientExpression: string, listName: string, data: string, done) => {
  record.setEntries(clientExpression, listName, data)
  setTimeout(done, defaultDelay)
})

Given(/^(.+) (adds|removes) an entry "([^"]*)" (?:to|from) "([^""]*)"$/, (clientExpression: string, action, entryName, listName, done) => {
  if (action === 'adds') {
    record.addEntry(clientExpression, listName, entryName)
  } else {
    record.removeEntry(clientExpression, listName, entryName)
  }
  setTimeout(done, defaultDelay)
})

Then(/^(.+) have a list "([^"]*)" with entries '([^']*)'$/, record.assert.hasEntries)

Then(/^(.+) gets? notified of "([^"]*)" being (added|removed|moved) (?:to|in|from) "([^""]*)"$/, (clientExpression: string, entryName, action, listName) => {
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

When(/(.+) sets? the underlying record to "([^"]*)" on the anonymous record$/, (clientExpression: string, recordName: string, done) => {
  record.setName(clientExpression, recordName)
  setTimeout(done, defaultDelay)
})

Then(/(.+) anonymous record data is '([^']*)'$/, (clientExpression: string, data: string) => {
  record.assert.anonymousRecordContains(clientExpression, data)
})

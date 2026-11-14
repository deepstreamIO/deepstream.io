import 'mocha'
import { expect } from 'chai'
import { EVENT_ACTION, TOPIC } from '../../constants'
import { MonitoringBase } from './monitoring-base'

class TestMonitoring extends MonitoringBase {
  public description = 'test monitoring'
}

const services: any = {
  clusterRegistry: { getAll: () => ['server-a'] },
  clusterStates: { getStateRegistries: () => new Map() }
}

const emit = { topic: TOPIC.EVENT, action: EVENT_ACTION.EMIT, name: 'someName' } as any
const subscribe = { topic: TOPIC.EVENT, action: EVENT_ACTION.SUBSCRIBE, name: 'someName' } as any

describe('monitoring base', () => {
  let monitoring: TestMonitoring

  beforeEach(() => {
    monitoring = new TestMonitoring(services)
  })

  it('counts broadcasts as sent, not received', () => {
    monitoring.onMessageReceived(emit, null as any)
    monitoring.onBroadcast(emit, 2)

    const stats = monitoring.getAndResetMonitoringStats()
    expect(stats.received).to.deep.equal({ EVENT: { EMIT: 1 } })
    expect(stats.send).to.deep.equal({ EVENT: { EMIT: 2 } })
  })

  it('adds broadcasts to what was already sent on the topic', () => {
    monitoring.onMessageSend(subscribe)
    monitoring.onBroadcast(emit, 3)
    monitoring.onBroadcast(emit, 2)

    const stats = monitoring.getAndResetMonitoringStats()
    expect(stats.received).to.deep.equal({})
    expect(stats.send).to.deep.equal({ EVENT: { SUBSCRIBE: 1, EMIT: 5 } })
  })

  it('resets the counters after reading them', () => {
    monitoring.onBroadcast(emit, 2)
    monitoring.getAndResetMonitoringStats()

    const stats = monitoring.getAndResetMonitoringStats()
    expect(stats.send).to.deep.equal({})
    expect(stats.clusterSize).to.equal(1)
  })
})

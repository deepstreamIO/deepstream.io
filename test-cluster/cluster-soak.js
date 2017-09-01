'use strict'
const ClusterNode = require('../src/cluster/cluster-node')
const utils = require('../src/utils/utils')
const Redis = require('ioredis')
const fs = require('fs')
const profiler = require('@risingstack/v8-profiler')

const C = {
  NODE_START: 'NODE_START',
  NODE_STOP: 'NODE_STOP',
  SUBSCRIPTION_ADDED: 'SUBSCRIPTION_ADDED',
  SUBSCRIPTION_REMOVED: 'SUBSCRIPTION_REMOVED',
  INVALID_NODE_COUNT: 'INVALID_NODE_COUNT',
  INVALID_SUBSCRIPTION_COUNT: 'INVALID_SUBSCRIPTION_COUNT',
  MAX_CONSECUTIVE_ERRORS_REACHED: 'MAX_CONSECUTIVE_ERRORS_REACHED'
}

module.exports = function (program) {
  program
    .command('soak')
    .description('start a deepstream server')

    .option('--start-port <start-port>', 'intial port to start nodes')
    .option('--init <init>', 'flag deciding whether or not to clear the redis state')
    .option('--states <states>', 'amount of state registries')
    .option('--subscriptions <subscriptions>', 'total amount of subscriptions')
    .option('--nodes <nodes>', 'amount of nodes')
    .option('--cluster-seed <nodes>', "array of machines to seed to 'localhost:6050','32.52.42.12:5022'")
    .option('--node-rate <node-rate>', 'time between add/removing nodes')
    .option('--subscription-rate <subscription-rate>', 'time between add/removing subscriptions')

    .action(action)
}

const redis = new Redis()
const logFile = new Date().toString()
const fsLog = (data) => {
  console.log(data)
  fs.appendFile(`./logs/${logFile}`, `${Date.now()},${data}\n`, () => {})
}
const logger = { log: () => {} }
const ports = []
const clusters = {}

const maxConsecutiveErrors = 10

let consecutiveNodeCountErrors = 0
let consecutiveSubscriptionsErrors = 0

const config = {
  startPort: 3030,
  stateCount: 10,
  subscriptionCount: 1,
  nodeCount: 10,
  maxConsecutiveErrors: 10,
  subscriptionRate: 1000,
  nodeRate: 2500
}

function getLowestAvailablePort (currentPorts) {
  let possiblePort = config.startPort
  while (true) {
    if (currentPorts.indexOf(possiblePort.toString()) === -1) {
      break
    }
    possiblePort++
  }
  return possiblePort
}

async function createClusterNode () {
  const currentPorts = await redis.lrange('nodes', 0, -1)
  const port = getLowestAvailablePort(currentPorts)
  await redis.lpush('nodes', port)

  const serverName = port.toString()  // insert into set
  const node = new ClusterNode({
    serverName,
    logger,
    messageConnector: {
      host: 'localhost',
      port,
      seedNodes: currentPorts.map(p => `localhost:${p}`),
      maxReconnectAttempts: 4,
      reconnectInterval: 1500,
      pingTimeout: 500,
      pingInterval: 1000
    }
  })

  ports.push(port)
  const cluster = { serverName, node, states: [] }
  clusters[port] = cluster
  await setupRegistries(cluster)
  fsLog(`${C.NODE_START},${port}`)
}

async function setupRegistries (cluster) {
  const pipeline = redis.pipeline()
  for (let i = 0; i < config.stateCount; i++) {
    const topic = `TOPIC_${i}`
    const stateRegistry = cluster.node.getStateRegistry(topic)
    for (let j = 0; j < config.subscriptionCount; j++) {
      const subscription = utils.getUid()
      stateRegistry.add(subscription)
    }
    pipeline.lpush(topic, stateRegistry.getAll(cluster.node.serverName))
    cluster.states.push(stateRegistry)
  }
  await pipeline.exec()
}

async function killClusterNode () {
  const index = utils.getRandomIntInRange(0, ports.length)
  const localPort = ports[index]
  if (localPort == config.startPort) {
    return
  }
  const cluster = clusters[localPort]

  cluster.node.close(() => {})

  for (let i = 0; i < cluster.states.length; i++) {
    const registry = cluster.states[i]
    const subscriptions = registry.getAll(localPort)
    for (let j = 0; j < subscriptions.length; j++) {
      await redis.lrem(registry._topic, 0, subscriptions[j])
    }
  }

  ports.splice(index, 1)
  await redis.lrem('nodes', 0, localPort)
  delete clusters[localPort]

  fsLog(`${C.NODE_STOP},${localPort}`)
}

async function startStopNodes () {
  const start = getRandomBool()
  if (start) {
    const currentNodeCount = ports.length
    if (currentNodeCount === config.nodeCount) {
      return
    }
    await createClusterNode()
  } else {
    if (ports.length === 1) {
      return
    }
    await killClusterNode()
  }
}

async function addRemoveSubscriptions () {
  const index = utils.getRandomIntInRange(0, ports.length)
  const cluster = clusters[ports[index]]

  const topic = `TOPIC_${utils.getRandomIntInRange(0, config.stateCount)}`
  const registry = cluster.node.getStateRegistry(topic)
  const add = getRandomBool()
  if (add) {
    const subscription = utils.getUid()
    registry.add(subscription)
    fsLog(`${C.SUBSCRIPTION_ADDED},${topic}`)
    await redis.lpush(topic, subscription)
  } else {
    const clusterSubscriptions = registry.getAll(ports[index])
    if (clusterSubscriptions.length === 0) {
      return
    }
    const i = utils.getRandomIntInRange(0, clusterSubscriptions.length)
    fsLog(`${C.SUBSCRIPTION_REMOVED},${topic}`)
    registry.remove(clusterSubscriptions[i])
    await redis.lrem(topic, 0, clusterSubscriptions[i])
  }
}

async function action () {
  if (this.nodes) {
    config.nodeCount = Number(this.nodes)
  }
  if (this.subscriptions) {
    config.subscriptionCount = Number(this.subscriptions)
  }
  if (this.states) {
    config.stateCount = Number(this.states)
  }
  if (this.subscriptionRate) {
    config.subscriptionRate = Number(this.subscriptionRate)
  }
  if (this.nodeRate) {
    config.nodeRate = Number(this.nodeRate)
  }
  if (this.startPort) {
    config.startPort = Number(this.startPort)
  }
  if (this.init) {
    await redis.flushall()
  }

  if (this.clusterSeed) {
    //globalSeedNodes = localSeedNodes.concat(this.clusterSeed.split(','))
  } else {
    //globalSeedNodes = localSeedNodes
  }

  /**
   * Initialise Cluster
   */
  for (let i = 0; i < config.nodeCount; i++) {
    await createClusterNode(3030 + i)
  }

  await sleep(1000)

  /**
   * Adding / removing nodes
   */
  setTimeout(async () => {
    startStopCheckNodes()
  }, config.nodeRate)

  /**
   * Adding / removing subscriptions
   */
  setInterval(async () => {
    await addRemoveSubscriptions()
    await checkSubscriptionState()
  }, config.subscriptionRate)


}

async function startStopCheckNodes () {
  await startStopNodes()
  await sleep(500)
  await checkNodeState()
  setTimeout(startStopCheckNodes, config.nodeRate)
}

async function checkNodeState () {
  const redisNodes = await redis.lrange('nodes', 0, -1)
  for (const port in clusters) {
    const expected = redisNodes.length - 1
    const actual = clusters[port].node._getPeers().length
    if (expected !== actual) {
      fsLog(`${C.INVALID_NODE_COUNT},${expected},${actual}`)
      consecutiveNodeCountErrors++
      if (consecutiveNodeCountErrors === maxConsecutiveErrors) {
        fsLog(C.MAX_CONSECUTIVE_ERRORS_REACHED)
        process.exit(1)
      }
    } else {
      consecutiveNodeCountErrors = 0
    }
  }
}

async function checkSubscriptionState () {
  const errors = []
  for (let i = 0; i < config.stateCount; i++) {
    const topic = `TOPIC_${i}`
    for (const port in clusters) {
      const registry = clusters[port].node.getStateRegistry(topic)
      const redisEntries = await redis.llen(topic)
      const registryEntries = registry.getAll()
      if (redisEntries !== registryEntries.length) {
        errors.push(`server ${port} has invalid subscriptions on topic ${topic} expected ${redisEntries} actual ${registryEntries.length}`)
      }
    }
  }
  if (errors.length !== 0) {
    fsLog(`${C.INVALID_SUBSCRIPTION_COUNT},${errors.length}`)
    consecutiveSubscriptionsErrors++
    if (consecutiveSubscriptionsErrors === maxConsecutiveErrors) {
      fsLog(C.MAX_CONSECUTIVE_ERRORS_REACHED)
      process.exit(1)
    } else {
      consecutiveSubscriptionsErrors = 0
    }
  }
}

function sleep (duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

function getRandomBool () {
  return Math.random() > 0.5
}

setInterval(() => {
  const snapshot = profiler.takeSnapshot()
  snapshot.export((error, result) =>
    fs.writeFileSync(`./logs/${new Date(Date.now())}-dump.heapprofile`, result)
  )
}, 1800)

'use strict'
const ClusterNode = require('../src/cluster/cluster-node')
const utils = require('../src/utils/utils')
const Redis = require('ioredis')
const fs = require('fs')

const C = {
  NODE_START: 'NODE_START',
  NODE_STOP: 'NODE_STOP',
  SUBSCRIPTION_ADDED: 'SUBSCRIPTION_ADDED',
  SUBSCRIPTION_REMOVED: 'SUBSCRIPTION_REMOVED',
  INVALID_NODE_COUNT: 'INVALID_NODE_COUNT',
  INVALID_SUBSCRIPTION_COUNT: 'INVALID_SUBSCRIPTION_COUNT'
}

module.exports = function (program) {
  program
    .command('soak')
    .description('start a deepstream server')

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
const localSeedNodes = []

let globalSeedNodes = []

let stateCount = 10
let subscriptionCount = 100
let nodeCount = 10

let subscriptionRate = 1000
let nodeRate = 2500

async function createClusterNode (port) {
  ports.push(port)

  const serverName = port

  // insert into set
  const node = new ClusterNode({
    serverName,
    logger,
    messageConnector: {
      host: 'localhost',
      port,
      seedNodes: globalSeedNodes,
      maxReconnectAttempts: 4,
      reconnectInterval: 1500,
      pingTimeout: 500,
      pingInterval: 1000
    }
  })

  const cluster = { serverName, node, states: [] }
  await redis.lpush('nodes', serverName)
  await setupRegistries(cluster)
  fsLog(`${C.NODE_START},${port}`)
  clusters[port] = cluster
  globalSeedNodes.push(`localhost:${port}`)
  console.log('with', globalSeedNodes.length, 'seed nodes')
}

async function setupRegistries (cluster) {
  const pipeline = redis.pipeline()
  for (let i = 0; i < stateCount; i++) {
    const topic = `TOPIC_${i}`
    const stateRegistry = cluster.node.getStateRegistry(topic)
    for (let j = 0; j < subscriptionCount; j++) {
      const subscription = utils.getUid()
      stateRegistry.add(subscription)
    }
    pipeline.lpush(topic, stateRegistry.getAll(cluster.node.serverName))
    cluster.states.push(stateRegistry)
  }
  await pipeline.exec()
}

async function startStopNodes () {
  const start = getRandomBool()
  if (start) {
    const currentNodeCount = ports.length
    if (currentNodeCount === nodeCount) {
      return
    }

    const lastPort = ports[ports.length - 1]
    const newPort = lastPort + 1
    await createClusterNode(newPort)
  } else {
    if (ports.length === 2) {
      return
    }
    const cPorts = Object.keys(clusters)
    const index = utils.getRandomIntInRange(0, cPorts.length)
    const port = cPorts[index]
    const cluster = clusters[port]
    delete clusters[port]

    for (let i = 0; i < cluster.states.length; i++) {
      const registry = cluster.states[i]
      const subscriptions = registry.getAll(port)
      for (let j = 0; j < subscriptions.length; j++) {
        await redis.lrem(registry._topic, 0, subscriptions[j])
      }
    }

    cluster.node.close(() => {})

    ports.splice(index, 1)
    globalSeedNodes.splice(globalSeedNodes.indexOf(`localhost:${port}`), 1)

    await redis.lrem('nodes', 0, port)

    fsLog(`${C.NODE_STOP},${port}`)
  }
}

async function addRemoveSubscriptions () {
  const index = utils.getRandomIntInRange(0, ports.length)
  const cluster = clusters[ports[index]]

  const topic = `TOPIC_${utils.getRandomIntInRange(0, stateCount)}`
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

async function clearRedisState () {
  for (let i = 0; i < stateCount; i++) {
    const topic = `TOPIC_${i}`
    await redis.del(topic)
  }
  await redis.del('nodes')
}

async function action () {
  if (this.nodes) {
    nodeCount = Number(this.nodes)
  }
  if (this.subscriptions) {
    subscriptionCount = Number(this.subscriptions)
  }
  if (this.states) {
    stateCount = Number(this.states)
  }
  if (this.subscriptionRate) {
    subscriptionRate = Number(this.subscriptionRate)
  }
  if (this.nodeRate) {
    nodeRate = Number(this.nodeRate)
  }

  await clearRedisState()

  if (this.clusterSeed) {
    globalSeedNodes = localSeedNodes.concat(this.clusterSeed.split(','))
  } else {
    globalSeedNodes = localSeedNodes
  }

  /**
   * Initialise Cluster
   */
  for (let i = 0; i < nodeCount; i++) {
    await createClusterNode(3030 + i)
  }

  await sleep(1000)

  /**
   * Adding / removing nodes
   */
  setTimeout(async () => {
    startStopCheckNodes()
  }, nodeRate)

  /**
   * Adding / removing subscriptions
   */
  setInterval(async () => {
    await addRemoveSubscriptions()
    await checkSubscriptionState()
  }, subscriptionRate)
}

async function startStopCheckNodes () {
  await startStopNodes()
  await sleep(500)
  await checkNodeState()
  setTimeout(startStopCheckNodes, nodeRate)
}

async function checkNodeState () {
  const redisNodes = await redis.lrange('nodes', 0, -1)
  for (const port in clusters) {
    const expected = redisNodes.length - 1
    const actual = clusters[port].node.getAll().length
    if (expected !== actual) {
      fsLog(`${C.INVALID_NODE_COUNT},${expected},${actual}`)
    }
  }
}

async function checkSubscriptionState () {
  const errors = []
  for (let i = 0; i < stateCount; i++) {
    const topic = `TOPIC_${i}`
    for (const port in clusters) {
      const registry = clusters[port].node.getStateRegistry(topic)
      const redisEntries = await redis.llen(topic)
      const registryEntries = registry.getAll()

      if (redisEntries !== registryEntries.length) {
        errors.push(`server ${port} has invalid subscriptions on topic ${topic} expected ${redisEntries} actual ${registryEntries.length}`)
      }

      // for (let j = 0; j < redisEntries.length; j++) {
      //   if (registryEntries.indexOf(redisEntries[j]) === -1) {
      //     errors.push(`state inconsistent, redis has ${redisEntries[j]} but state registry ${topic} does not`)
      //   }
      // }

      // for (let j = 0; j < registryEntries.length; j++) {
      //   if (redisEntries.indexOf(registryEntries[j]) === -1) {
      //     errors.push(`state inconsistent, state ${topic} has ${registryEntries[j]} but redis does not`)
      //   }
      // }
    }
  }
  if (errors.length !== 0) {
    fsLog(`${C.INVALID_SUBSCRIPTION_COUNT},${errors.length}`)
  }
}

function sleep (duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

function getRandomBool () {
  return Math.random() > 0.5
}

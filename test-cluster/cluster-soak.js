'use strict'
const ClusterNode = require('../src/cluster/cluster-node')
const utils = require('../src/utils/utils')
const Redis = require('ioredis')

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
const logger = { log: () => {} }
const ports = []
const clusters = {}
const localSeedNodes = []

let globalSeedNodes = []

let stateCount = 1
let subscriptionCount = 10
let nodeCount = 2

let subscriptionRate = 10000
let nodeRate = 1000

async function createClusterNode (port) {
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

  clusters[port] = { serverName, node, states: [] }
  await setupRegistries(clusters[port])
}

async function setupRegistries (cluster) {
  for (let i = 0; i < stateCount; i++) {
    const topic = `TOPIC_${i}`
    const stateRegistry = cluster.node.getStateRegistry(topic)
    for (let j = 0; j < subscriptionCount; j++) {
      const subscription = utils.getUid()
      stateRegistry.add(subscription)
      await redis.lpush(topic, subscription)
    }
    cluster.states.push(stateRegistry)
  }
}

function startStopNodes () {
  const start = getRandomBool()
  if (start) {
    if (ports.length === nodeCount) {
      return
    }
    console.log('>>> starting node')

    const lastPort = ports[ports.length - 1]
    const newPort = lastPort + 1
    ports.push(newPort)
    localSeedNodes.push(`localhost:${newPort}`)
    createClusterNode(newPort)
  } else {
    if (ports.length === 1 || localSeedNodes.length === 1) {
      return
    }
    console.log('>>> removing node')

    const index = utils.getRandomIntInRange(0, ports.length)
    const port = ports[index]

    clusters[port].node.close(() => {})

    delete clusters[port]

    ports.splice(index, 1)
    localSeedNodes.splice(localSeedNodes.indexOf(port), 1)
    // delete states in redis
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
    await redis.lpush(topic, subscription)
  } else {
    const clusterSubscriptions = registry.getAll(ports[index])
    if (clusterSubscriptions.length === 0) {
      return
    }
    const i = utils.getRandomIntInRange(0, clusterSubscriptions.length)

    registry.remove(clusterSubscriptions[i])
    await redis.lrem(topic, 0, clusterSubscriptions[i])
  }
}

async function clearRedisState () {
  for (let i = 0; i < stateCount; i++) {
    const topic = `TOPIC_${i}`
    await redis.del(topic)
  }
}

async function action () {
  if (this.nodes) {
    nodeCount = this.nodes
  }
  if (this.subscriptions) {
    subscriptionCount = this.subscriptions
  }
  if (this.states) {
    stateCount = this.states
  }
  if (this.subscriptionRate) {
    subscriptionRate = this.subscriptionRate
  }
  if (this.nodeRate) {
    nodeRate = this.nodeRate
  }

  await clearRedisState()

  if (this.clusterSeed) {
    globalSeedNodes = localSeedNodes.concat(this.clusterSeed.split(','))
  } else {
    globalSeedNodes = localSeedNodes
  }

  for (let i = 0; i < (nodeCount || 2); i++) {
    ports.push(3030 + i)
    localSeedNodes.push(`localhost:${3030 + i}`)
  }

  /**
   * Initialise Cluster
   */
  for (let i = 0; i < ports.length; i++) {
    await createClusterNode(3030 + i)
  }

  await sleep(1000)
  console.log('Nodes initialised')

  /**
   * Adding / removing nodes
   */
  // setInterval(() => {
  //   startStopNodes()
  // }, nodeRate)


  /**
   * Adding / removing subscriptions
   */
  setInterval(() => {
    addRemoveSubscriptions()
  }, subscriptionRate)

  /**
   * Assertions
   */

  /**
   * Adding / Removing Subscriptions
   */
  setInterval(() => {
    // assert getAll is the same as redis.getServerNames
    const clusterSize = Object.keys(clusters).length
    for (const port in clusters) {
      if (clusterSize !== clusters[port].node.getAll().length + 1) {
        console.error(`Invalid amount of nodes on ${port}`)
      }
    }
  }, 5000)

  /**
   * Subscriptions are valid
   */
  setInterval(async () => {
    const errors = []
    for (let i = 0; i < stateCount; i++) {
      const topic = `TOPIC_${i}`
      for (const port in clusters) {
        const registry = clusters[port].node.getStateRegistry(topic)
        const redisEntries = await redis.lrange(topic, 0, -1)
        const registryEntries = registry.getAll()
        // console.log(port, topic, 'redis', redisEntries.length, 'registry', registryEntries.length)
        if (redisEntries.length !== registryEntries.length) {
          errors.push(`server ${port} has invalid subscriptions on topic ${topic} expected ${redisEntries.length} actual ${registryEntries.length}`)
        }

        for (let j = 0; j < redisEntries.length; j++) {
          if (registryEntries.indexOf(redisEntries[j]) === -1) {
            errors.push(`state inconsistent, redis has ${redisEntries[j]} but state registry ${topic} does not`)
          }
        }

        for (let j = 0; j < registryEntries.length; j++) {
          if (redisEntries.indexOf(registryEntries[j]) === -1) {
            errors.push(`state inconsistent, state ${topic} has ${registryEntries[j]} but redis does not`)
          }
        }
      }
    }
    if (errors.length !== 0) {
      console.error(errors.length, 'errors')
    } else {
      console.log('state consistent')
    }
  }, 5000)
}

function sleep (duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

function getRandomBool () {
  return Math.random() > 0.5
}

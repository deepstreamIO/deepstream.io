'use strict'
const ClusterNode = require('../src/cluster/cluster-node')
const utils = require('../src/utils/utils')


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

const logger = { log: () => {} }
const ports = []
const clusters = {}
const subscriptions = {}
const localSeedNodes = []

let globalSeedNodes = []

let stateCount = 1
let subscriptionCount = 10
let nodeCount = 2

let subscriptionRate = 10000
let nodeRate = 1000

function createClusterNode (port) {
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
  setupRegistries(clusters[port])
}

function setupRegistries (cluster) {

  for (let i = 0; i < stateCount; i++) {
    const topic = `TOPIC_${i}`
    const stateRegistry = cluster.node.getStateRegistry(topic)
    for (let j = 0; j < subscriptionCount; j++) {
      const subscription = utils.getUid()
      if (!subscriptions[topic]) {
        subscriptions[topic] = []
      }
      if (stateRegistry.has(subscription)) {
        return
      }
      stateRegistry.add(subscription)
      subscriptions[topic].push(subscription)
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

function addRemoveSubscriptions () {
  for (const port in clusters) {
    const cluster = clusters[port]
    const topic = `TOPIC_${utils.getRandomIntInRange(0, stateCount)}`
    const registry = cluster.node.getStateRegistry(topic)
    const add = getRandomBool()
    if (add) {
      const subscription = utils.getUid()
      if (registry.has(subscription)) {
        return
      }
      // insert into redis
      console.log(subscriptions[topic].indexOf(subscription))
      registry.add(subscription)
      subscriptions[topic].push(subscription)
      console.log('adding', subscription, 'to', topic)
    } else {
      const clusterSubscriptions = registry.getAll()
      const index = utils.getRandomIntInRange(0, clusterSubscriptions.length)
      registry.remove(clusterSubscriptions[index])

      // remove from local map
      console.log('removing', clusterSubscriptions[index], 'from', topic)
      console.log(1, subscriptions[topic])
      const localIndex = subscriptions[topic].indexOf(clusterSubscriptions[index])
      console.log('localIndex', localIndex)
      subscriptions[topic].splice(localIndex, 1)
      console.log(subscriptions[topic])
      //getFromRedis()
    }
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
    createClusterNode(3030 + i)
    await sleep(1000)
  }

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
  setInterval(() => {
    for (let i = 0; i < stateCount; i++) {
      const topic = `TOPIC_${i}`
      for (const port in clusters) {
        const registry = clusters[port].node.getStateRegistry(topic)
        if (registry.getAll().length !== subscriptions[topic].length) {
          console.error(
            'invalid subscriptions on port', port,
            'subscriptions', registry.getAll().length,
            'expected', subscriptions[topic].length
          )
        }
      }
    }
  }, 1000)
}

function sleep (duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

function getRandomBool () {
  return Math.random() > 0.5
}

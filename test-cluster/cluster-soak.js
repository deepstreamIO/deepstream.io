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
    console.time(i)
    const stateRegistry = cluster.node.getStateRegistry(`TOPIC_${i.toString()}`)
    for (let j = 0; j < subscriptionCount; j++) {
      stateRegistry.add(utils.getUid())
    }
    console.timeEnd(i)
    cluster.states.push(stateRegistry)
  }
}

function startStopNode () {
  const start = Math.random() > 0.5
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

    clusters[port].close(() => {})

    delete clusters[port]

    ports.splice(index, 1)
    localSeedNodes.splice(localSeedNodes.indexOf(port), 1)
    // delete states in redis
  }
}

function addRemoveSubscriptions() {
 setInterval(() => {
    const add = Math.random() > 0.5
    if (add) {
      const topic = getUid()
      // insert into redis
      registry.add(topic)
    } else {
      const topic = getFromRedis()
      registry.remove(topic)
    }
  }, subscriptionRate)
}

function action () {
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
    setTimeout(() => { // eslint-disable-line
      createClusterNode(3030 + i)
    }, (1000 * i) + 1)
  }

  /**
   * Adding / Removing nodes
   */
  // setTimeout(() => {
  //   setInterval(() => {
  //     startStopNode(localSeedNodes)
  //   }, nodeRate)
  // }, 1000 * ports.length)

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
    console.log('==== START ====')
    for (let i = 0; i < stateCount; i++) {
      console.log(`
TOPIC_${i.toString()}
--------`)
      for (const port in clusters) {
        const stateRegistry = clusters[port].states[i]
        console.log(port, '|', stateRegistry.getAll().length)
      }
    }
    console.log('==== DONE ====')
  }, 5000)
}


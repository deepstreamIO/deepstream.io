import { DeepstreamServices, DeepstreamConfig, ClusterRegistry, DeepstreamPlugin, EVENT } from '@deepstream/types'
import { TOPIC, ClusterMessage, CLUSTER_ACTION } from '../../constants'
import { EventEmitter } from 'events'

/**
 * This class maintains a list of all nodes that are
 * currently present within the cluster.
 *
 * It provides status messages on a predefined interval
 * and keeps track of incoming status messages.
 */
export class DistributedClusterRegistry extends DeepstreamPlugin implements ClusterRegistry {
    public description: string = 'Distributed Cluster Registry'
    private inCluster: boolean = false
    private nodes = new Map<string, { lastStatusTime: number, leaderScore: number }>()
    private leaderScore = Math.random()
    private publishInterval!: NodeJS.Timeout
    private checkInterval!: NodeJS.Timeout
    private role: string
    private emitter = new EventEmitter()

    /**
     * Creates the class, initialises all intervals and publishes the
     * initial status message that notifies other nodes within this
     * cluster of its presence.
     */
    constructor (private pluginOptions: any, private services: Readonly<DeepstreamServices>, private config: Readonly<DeepstreamConfig>) {
        super()
        this.role = this.pluginOptions.role || 'deepstream'
    }

    public init () {
        this.services.clusterNode.subscribe(TOPIC.CLUSTER, this.onMessage.bind(this))
        this.leaveCluster = this.leaveCluster.bind(this)

        this.publishStatus()

        this.publishInterval = setInterval(
            this.publishStatus.bind(this),
            this.pluginOptions.keepAliveInterval
        )

        this.checkInterval = setInterval(
            this.checkNodes.bind(this),
            this.pluginOptions.activeCheckInterval
        )
    }

    public async close (): Promise<void> {
      return new Promise((resolve) => {
        this.emitter.once('close', resolve)
        this.leaveCluster()
      })
    }

    public onServerAdded (callback: (serverName: string) => void) {
        this.emitter.on('server-added', callback)
    }

    public onServerRemoved (callback: (serverName: string) => void) {
        this.emitter.on('server-removed', callback)
    }

    /**
     * Returns the serverNames of all nodes currently present within the cluster
     */
    public getAll (): string[] {
        return [...this.nodes.keys()]
    }

    /**
     * Returns true if this node is the cluster leader
     */
    public isLeader (): boolean {
        return this.config.serverName === this.getLeader()
    }

    /**
     * Returns the name of the current leader
     */
    public getLeader () {
        let maxScore = 0
        let leader = this.config.serverName

        for (const [serverName, node] of this.nodes) {
            if (node.leaderScore > maxScore) {
                maxScore = node.leaderScore
                leader = serverName
            }
        }

        return leader
    }

    /**
     * Distributes incoming messages on the cluster topic
     */
    private onMessage (message: ClusterMessage) {
        if (message.action === CLUSTER_ACTION.STATUS) {
            this.updateNode(message)
            return
        }

        if (message.action === CLUSTER_ACTION.REMOVE) {
            this.removeNode(message.serverName)
            return
        }

        this.services.logger.error(EVENT.UNKNOWN_ACTION, `TOPIC: ${TOPIC[TOPIC.CLUSTER]} ${message.action}`)
    }

    /**
     * Called on an interval defined by clusterActiveCheckInterval to check if all nodes
     * within the cluster are still alive.
     *
     * Being alive is defined as having received a status message from that node less than
     * <clusterNodeInactiveTimeout> milliseconds ago.
     */
    private checkNodes () {
        const now = Date.now()
        for (const [serverName, node] of this.nodes) {
            if (now - node.lastStatusTime > this.pluginOptions.nodeInactiveTimeout) {
                this.removeNode(serverName)
            }
        }
    }

    /**
     * Updates the status of a node with incoming status data and resets its lastStatusTime.
     *
     * If the remote node doesn't exist yet, it is added and an add event is emitted / logged
     */
    private updateNode (message: ClusterMessage) {
        const node = this.nodes.get(message.serverName)

        this.nodes.set(message.serverName, {
            lastStatusTime: Date.now(),
            leaderScore: message.leaderScore!
        })

        if (node) {
            return
        }

        this.services.logger.info(EVENT.CLUSTER_JOIN, message.serverName)
        this.services.logger.info(EVENT.CLUSTER_SIZE, `The cluster size is now ${this.nodes.size}`)
        this.emitter.emit('server-added', message.serverName)
    }

    /**
     * Removes a remote node from this registry if it exists.
     * Logs/emits remove
     */
    private removeNode (serverName: string) {
        const deleted = this.nodes.delete(serverName)
        if (deleted) {
            this.services.logger.info(EVENT.CLUSTER_LEAVE, serverName)
            this.services.logger.info(EVENT.CLUSTER_SIZE, `The cluster size is now ${this.nodes.size}`)
            this.emitter.emit('server-removed', serverName)
        }
    }

    /**
     * Publishes this node's status on the message bus
     */
    private publishStatus (): void {
        this.inCluster = true
        const message = {
            topic: TOPIC.CLUSTER,
            action: CLUSTER_ACTION.STATUS,
            serverName: this.config.serverName,
            leaderScore: this.leaderScore,
            externalUrl: this.config.externalUrl,
            role: this.role
        } as ClusterMessage
        this.updateNode(message)
        this.services.clusterNode.send(message)
    }

    /**
     * Prompts this node to leave the cluster, either as a result of a server.close()
     * call or due to the process exiting.
     * This sends out a leave message to all other nodes and destroys this class.
     */
    private leaveCluster () {
        if (this.inCluster === false) {
            this.emitter.emit('close')
            return
        }

        this.services.logger.info(EVENT.CLUSTER_LEAVE, this.config.serverName)
        this.services.clusterNode.send({
            topic: TOPIC.CLUSTER,
            action: CLUSTER_ACTION.REMOVE,
            name: this.config.serverName
        })

        // TODO: If a message connector doesn't close this is required to avoid an error
        // being thrown during shutdown
        // this._options.messageConnector.unsubscribe( C.TOPIC.CLUSTER, this._onMessageFn );

        process.removeListener('beforeExit', this.leaveCluster)
        process.removeListener('exit', this.leaveCluster)
        clearInterval(this.publishInterval)
        clearInterval(this.checkInterval)
        this.nodes.clear()
        this.inCluster = false

        this.emitter.emit('close')
    }

}

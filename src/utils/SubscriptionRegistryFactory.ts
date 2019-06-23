import SubscriptionRegistry from './subscription-registry'
import { TOPIC } from '../../binary-protocol/src/message-constants'
import { DeepstreamConfig, DeepstreamServices } from '../types'

export class SubscriptionRegistryFactory {
    private subscriptionRegistries = new Map<TOPIC, SubscriptionRegistry>()

    constructor (private config: DeepstreamConfig, private services: DeepstreamServices) {
    }

    public getSubscriptionRegistry (topic: TOPIC, clusterTopic: TOPIC) {
        let subscriptionRegistry = this.subscriptionRegistries.get(topic)
        if (!subscriptionRegistry) {
            subscriptionRegistry = new SubscriptionRegistry(this.config, this.services, topic, clusterTopic)
            this.subscriptionRegistries.set(topic, subscriptionRegistry)
        }
        return subscriptionRegistry
    }

    public getSubscriptionRegistries () {
        return this.subscriptionRegistries
    }
}

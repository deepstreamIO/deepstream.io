import { DefaultSubscriptionRegistry } from './default-subscription-registry'
import { DeepstreamConfig, DeepstreamServices, DeepstreamPlugin, SubscriptionRegistryFactory, SubscriptionRegistry } from '@deepstream/types'
import { TOPIC } from '../../constants'

export class DefaultSubscriptionRegistryFactory extends DeepstreamPlugin implements SubscriptionRegistryFactory {
    public description: string = 'Subscription Registry'

    private subscriptionRegistries = new Map<TOPIC, SubscriptionRegistry>()

    constructor (private pluginOptions: any, private services: Readonly<DeepstreamServices>, private config: Readonly<DeepstreamConfig>) {
        super()
    }

    public getSubscriptionRegistry (topic: TOPIC, clusterTopic: TOPIC) {
        let subscriptionRegistry = this.subscriptionRegistries.get(topic)
        if (!subscriptionRegistry) {
            subscriptionRegistry = new DefaultSubscriptionRegistry(this.pluginOptions, this.services, this.config, topic, clusterTopic)
            this.subscriptionRegistries.set(topic, subscriptionRegistry)
        }
        return subscriptionRegistry
    }

    public getSubscriptionRegistries () {
        return this.subscriptionRegistries
    }
}

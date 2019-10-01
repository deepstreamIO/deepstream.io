// tslint:disable:no-shadowed-variable

import { clientHandler } from './client-handler'

export const world = {
  endTest (done: (...args: any[]) => void) {
    const clients = clientHandler.clients
    for (const client in clients) {
      clientHandler.assertNoErrors(client)

      for (const event in clients[client].event.callbacks) {
        if (clients[client].event.callbacks[event].isSubscribed !== false) {
          clients[client].client.event.unsubscribe(event, clients[client].event.callbacks[event])
        }
      }

      setTimeout(function (client: string) {
        for (const pattern in clients[client].event.callbacksListeners) {
          if (clients[client].event.callbacksListeners[pattern].isListening !== false) {
            clients[client].client.event.unlisten(pattern)
          }
        }
      }.bind(null, client), 1)

      setTimeout(function (client: string) {
        clients[client].client.close()
        delete clients[client]
      }.bind(null, client), 50)
    }

    setTimeout(done, 100)
  }
}

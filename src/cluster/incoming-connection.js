const ClusterConnection = require('./cluster-connection')

class IncomingConnection extends ClusterConnection {
  constructor (socket, config) {
    super(config)

    this._socket = socket
    this._configureSocket()
    this.on('known', this._stateTransition.bind(this, this.STATE.STABLE))
  }

  _onSocketError (error) {
    this.emit('error', error)
  }
}

module.exports = IncomingConnection

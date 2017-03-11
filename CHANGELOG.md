## [2.1.3] - 2017.02.25

### Bug Fixes

- Unsolicitated message in Listening when all clients unsubscribe [#531]
- Handle Non text based websocket frame [#538]
- Aligning binary config with node [#488]
- Event subscription data mishandled in Valve [#510]
- Logging after logger is destroyed [#527]
- Deepstream crash on empty users file [#512]
- Logging error object instead of name in connection error [#420]

### Enhancements

- maxRuleIterations must be 1 or higher [#498]
- Ignore sender in subscriptionRegistry if messagebus [#473]
- Removing dead config options [#599]
- getAlternativeProvider in RPC Handler deals with more edge cases [#566]
- Update UWS build version to 0.12
- Packages built against node 6.10

## [2.1.2] - 2016.12.28

### Bug fixes

- Fixing write error where only initial value is written to storage [#517](https://github.com/deepstreamIO/deepstream.io/issues/517)

## [2.1.1] - 2016.12.28

### Bug fixes

- Valve cross referencing in both a create and read results in a ack timeout [#514](https://github.com/deepstreamIO/deepstream.io/issues/514)

## [2.1.0] - 2016.12.20

### Features

- Record write acknowledgement. Records are now able to be set with an optional callback which will be called with any errors from storing the record in cache/storage [#472](https://github.com/deepstreamIO/deepstream.io/pull/472)

### Enhancements

- Applying an ESLint rule set to the repo [#482](https://github.com/deepstreamIO/deepstream.io/pull/482)
- Stricter valve permissioning language checks [#486](https://github.com/deepstreamIO/deepstream.io/pull/486) by [@Iiridayn](https://github.com/Iiridayn)
- Update uWS version to [v0.12.0](https://github.com/uWebSockets/uWebSockets/releases/tag/v0.12.0)

### Bug fixes

- Better handling/parsing of authentication messages [#463](https://github.com/deepstreamIO/deepstream.io/issues/463)
- Properly returning handshake data (headers) from SocketWrapper [#450](https://github.com/deepstreamIO/deepstream.io/issues/450)
- Fix case where CLIENT_DISCONNECTED is not sent from SocketWrapper [#470](https://github.com/deepstreamIO/deepstream.io/issues/470)
- Fixed issue where listen does not recover from server restart [#476](https://github.com/deepstreamIO/deepstream.io/issues/476)
- Handling presence events properly. Now when a user logs in, subscribed clients are only notified the first time the user logs in, and the last time they log out [#499](https://github.com/deepstreamIO/deepstream.io/pull/499)

## [2.0.1] - 2016.11.21

### Bug Fixes

- Fixed issue where connectionData was not available in auth requests
  [#450](https://github.com/deepstreamIO/deepstream.io/issues/450)
- Changelog of 2.0.0 mistakenly said that heartbeats were on port 80 instead of 6020

## [2.0.0] - 2016.11.18

### Features
- User presence has been added, enabling querying and subscription to who is
  online within a cluster
- Introduces the configuration option `broadcastTimeout` to `config.yml` to allow coalescing of
  broadcasts. This option can be used to improve broadcast message latency such
  as events, data-sync and presence
  For example, the perfomance of broadcasting 100 events to 1000 subscribers
  was improved by a factor of 20
- Adds client heartbeats, along with configuration option`heartbeatInterval` in `config.yml`.
  If a connected client fails to send a heartbeat within this timeout, it will be
  considered to have disconnected [#419](https://github.com/deepstreamIO/deepstream.io/issues/419)
- Adds healthchecks – deepstream now responds to http GET requests to path
  `/health-check` on port 6020 with code 200. This path can be configured with
  the `healthCheckPath` option in `config.yml`

### Enhancements
- E2E tests refactored
- uWS is now compiled into the deepstream binary, eliminating reliability
  issues caused by dynamic linking

### Breaking Changes

- Clients prior to v2.0.0 are no longer compatible
- Changed format of RPC request ACK messages to be more consistent with the
  rest of the specs
  [#408](https://github.com/deepstreamIO/deepstream.io/issues/408)
- We removed support for TCP and engine.io, providing huge perfomance gains by
  integrating tightly with native uWS
- Support for webRTC has been removed
- You can no longer set custom data transforms directly on deepstream

## [1.1.2] - 2016-10-17

### Bug Fixes

- Sending an invalid connection message is not caught by server [#401](https://github.com/deepstreamIO/deepstream.io/issues/401)

## [1.1.1] - 2016-09-30

### Bug Fixes

- Storage connector now logs errors with the correct namepspace [@Iiridayn](@Iiridayn)

### Enhancements

- RPC now uses distributed state and no longer depends on custom rpc discovery logic
- Deepstream now uses connection challenges by default rather than automatically replying with an ack
- Upgraded to uWS 0.9.0


## [1.1.0] - 2016-09-08

### Bug Fixes

- Fix wrong validation of valve permissions when `data` is used as a property [#346](https://github.com/deepstreamIO/deepstream.io/pull/346)

### Enhancements

- Outgoing connections now have throttle options that allow you to configure maximum package sizes to find your personal sweet spot between latency and speed

```yaml
# the time (in milliseconds) to wait for a buffer to fill before sending it out
timeBetweenSendingQueuedPackages: 1
# the amount of messages that should fit into a buffer before sending between the time to fill
maxMessagesPerPacket: 1000
```

### Features

- Listening: Listeners have been drastically improved [https://github.com/deepstreamIO/deepstream.io/issues/211], and now:
- works correctly across a cluster
- can inform the user whenever the last subscription has been removed even if the listener itself is subscribed
- only allows a single listener to provide a record
- has a concept of provided, allowing records on the client side to be aware if the data is being actively updated by a backend component

As part of this story, we now have multiple significant improvements in the server itself, such as:
- a `distributed state registry` which allows all clusters to keep their state in sync
- a `unique state provider` allowing cluster wide locks
- a `cluster-registry` that provides shares server presence and state across the cluster

Because of these we can now start working on some really cool features such as advanced failover, user presence and others!


## [1.0.4] - 2016-08-16

### Bug Fixes

- Auth: File authentication sends server data to client on cleartext passwords [#322](https://github.com/deepstreamIO/deepstream.io/issues/322)

- Auth: HTTP authentication missing logger during when attempting to log any errors occured on http server [#320](https://github.com/deepstreamIO/deepstream.io/issues/320)


## [1.0.3] - 2016-07-28

### Bug Fixes

- CLI: installer for connectors sometimes fail to download (and extract) the archive [#305](https://github.com/deepstreamIO/deepstream.io/issues/305)
- Auth: File authentication doesn't contain `serverData` and `clientData` [#304](https://github.com/deepstreamIO/deepstream.io/issues/304)

###### Read data using `FileAuthentication` using clientData and serverData rather than data

```yaml
userA:
  password: tsA+yfWGoEk9uEU/GX1JokkzteayLj6YFTwmraQrO7k=75KQ2Mzm
  serverData:
    role: admin
  clientData:
    nickname: Dave
```

### Features

###### Make connection timeout

Users can now provide a `unauthenticatedClientTimeout` config option that forces connections to close if they don't authenticate in time.
This helps reduce load on server by terminating idle connections.

- `null`: Disable timeout
- `number`: Time in milliseconds before connection is terminated

## [1.0.2] - 2016-07-19

### Bug Fixes

- Fixed issue regarding last subscription to a deleted record not being cleared up

## [1.0.1] - 2016-07-18

### Bug Fixes

- Fix issue when try to pass options to the default logger [#288](https://github.com/deepstreamIO/deepstream.io/pull/288) ([update docs](https://github.com/deepstreamIO/deepstream.io-website/pull/35/commits/838617d93cf00e66176cdf06d161fd8f86574aa1) as well)

- Fix issue deleting a record does not unsubscribe it and all other connections, not allowing resubscriptions to occur #293

#### Enhancements

###### Throw better error if dependency doesn't implement Emitter or isReady

## [1.0.0] - 2016-07-09

### Features

###### CLI
You can start deepstream via a command line interface. You find it in the _bin_ directory. It provides these subcommands:
  - `start`
  - `stop`
  - `status`
  - `install`
  - `info`
  - `hash`
  append a `--help` to see the usage.

###### File based configuration
You can now use a file based configuration instead of setting options via `ds.set(key, value)`.
deepstream is shipped with a _conf_ directory which contains three files:
  - __config.yml__ this is the main config file, you can specify most of the deepstream options in that file
  - __permissions.yml__ this file can be consumed by the PermissionHandler. It's not used by default, but you can enable it in the _config.yml_
  - __users.yml__ this file can be consumed by the AuthenticationHandler. It's not used by default, but you can enable it in the _config.yml_

For all config types support these file types: __.yml__, __.json__ and __.js__

###### Constructor API
There are different options what you can pass:
  - not passing any arguments ( consistent with 0.x )
  - passing `null` will result in loading the default configuration file in the directory _conf/config.yml_
  - passing a string which is a path to a configuration file, supported formats: __.yml__, __.json__ and __.js__
  - passing an object which defines several options, all other options will be merged from deepstream's default values

###### Valve permissions rules
You can write your permission into a structured file. This file supports a special syntax, which allows you to do advanced permission checks. This syntax is called __Valve__.

#### Enhancements

###### uws
deepstream now uses [uws](https://github.com/uWebSockets/uWebSockets), a native C++ websocket server

###### no process.exit on plugin initialization error or timeout
deepstream will not longer stops your process via `process.exit()`. This happened before when a connector failed to initialise correctly [#243](https://github.com/deepstreamIO/deepstream.io/issues/243) instead it will throw an error now.

Currently the API provides no event or callback to handle this error
other than subscribing to the global `uncaughtException` event.

```javascript
process.once('uncaughtException', err => {
  // err.code will equal to of these constant values:
  // C.EVENT.PLUGIN_INITIALIZATION_TIMEOUT
  // or C.EVENT.PLUGIN_INITIALIZATION_ERROR
})
```
Keep in mind that deepstream will be in an unpredictable state and you should consider to create a new instance.

### Breaking Changes

###### Permission Handler
In 0.x you can set a `permissionHandler` which needs to implement two functions:

- `isValidUser(connectionData, authData, callback)`
- `canPerformAction(username, message, callback)`

In deepstream 1.0 the `isValidUser` and `onClientDisconnect` methods are no longer part of the `permissionHandler` and are instead within the new `authenticationHandler`.

You can reuse the same 0.x permission handler except you will have to set it on both explicitly.

```javascript
const permissionHandler = new CustomPermissionHandler()
ds.set( 'permissionHandler', permissionHandler )
ds.set( 'authenticationHandler', permissionHandler )
```

###### Plugin API
All connectors including, the `permissionHandler`, `authenticationHandler` and `logger` all need to implement the plugin interface which means exporting an object that:

- has a constructor
- has an `isReady` property which is true once the connector has been initialized. For example in the case a database connector this would only be `true` once the connection has been established. If the connector is synchronous you can set this to true within the constructor.
- extends the EventEmitter, and emits a `ready` event once initialized and `error` on error.

###### Logger and colors options
The color flag can't be set in the root level of the configuration anymore.
The default logger will print logs to the StdOut/StdErr in colors.
You can use the [deepstream.io-logger-winston](https://www.npmjs.com/package/deepstream.io-logger-winston) which can be configured in the config.yml file with several options.

###### Connection redirects
deepstream clients now have a handshake protocol which allows them to be redirected to the most efficient node and expect an initial connection ack before logging in. As such In order to connect a client to deepstream server you need also to have a client with version 1.0 or higher.

More details in the [client changelog](https://github.com/deepstreamIO/deepstream.io-client-js/blob/master/CHANGELOG.md).

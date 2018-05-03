## [3.1.2] - 2018.05.03

### Fixes

- Loading a record for valve that doesn't exist results in an infinite loop

## [3.1.1] - 2017.10.24

### Improvements

- Lists can now be written to via the HTTP API using the `listName` option. Valid operations include `read`, `delete` and `write`.

### Fixes

- Fix regression where server crashed when using `storageHotPathPatterns` with record write acknowledgements.

## [3.1.0] - 2017.09.25

### Features

- a new standardised logging API with `debug`, `info`, `warn` and `error` methods
- the presence feature can now be used on a per user basis. The online status of individual users can be queried for as well as subscribed to. Check out the tutorial on our website [here](https://deepstreamhub.com/tutorials/guides/presence/)

### Improvements

- `perMessageDeflate` option can now be passed to uws, courtesy of [@daviderenger](@daviderenger) [#786](https://github.com/deepstreamIO/deepstream.io/pull/786)
- various fixes and performance improvements to the subscription registry [#780](https://github.com/deepstreamIO/deepstream.io/pull/780), courtesy of [@ronag](@ronag).

### Fixes

- allow updating and writing to Lists via the HTTP API [#788](https://github.com/deepstreamIO/deepstream.io/pull/788) courtesy of [@rbarroetavena](@rbarroetavena)
- no data when sending HTTP requests is now considered undefined, rather than null [#798](https://github.com/deepstreamIO/deepstream.io/pull/798).

### Miscellaneous

- internal refactor to pull e2e client operations into framework and abstract from Cucumber steps.

## [3.0.1] - 2017.08.14

### Features

- Added a `restart` option to deepstream service CLI
- deepstream will now write to a pid file at `/var/run/deepstream/deepstream.pid` while running as a service
- Authentication and permission plugins can now be configured via config and will be resolved as normal plugins. Either a path or name will need to be provided at the top level, and any options specified will also be passed in.

## [3.0.0] - 2017.07.26

### Features

#### [HTTP API](https://deepstreamhub.com/docs/http/v1/)
Enabling clients to create, read, update and delete records, emit events, request RPCS
and read presence using a JSON bulk request/response format via HTTP.
- The HTTP API is enabled by default on PORT 8080 and can be configured in the
connectionEndpoints -> http section of deepstream's `config.yml`
- To disable the HTTP API set the above config to null

#### [PHP Client Support](https://deepstreamhub.com/docs/client-php/DeepstreamClient/)
The above HTTP API makes deepstream.io compatible with the deepstream PHP client

#### Multi Endpoint Architecture
The deepstream 3.0 release lays the groundwork for multiple combinable endpoints/protocols,
e.g. GraphQL or Binary to be used together. It also introduces a new endpoint type enabling
developers to write their own. Please note - at the moment it is not possible to run multiple subscription
based endpoints (e.g. websocket) simultaneously.

#### Message Connector Discontinuation
To address the scalability issues associated with the message connector interface's coarse topics
deepstream will move to a build-in, high performance p2p/small world network based clustering approach, available
as an enterprise plugin. The current message connector support is discontinued.

### Miscellaneous
- Moved end-to-end tests into this repository from `deepstream.io-client-js`.
- Replaced `javascript-state-machine` dependency with custom state machine.

### Fixes
- Improved handling of invalid record names.

## [2.4.0] - 2017.07.01

## Features

- Added new CLI command, including:

  + deepstream daemon
  This command forks deepstream and monitors it for crashes, allowing it to restart automatically to avoid downtime

  + deepstream service add
  This command allows you to create an init.d or systemd script automatically and add it to your system.
  ```bash
  sudo deepstream service --help
  Usage: service [options] [add|remove|start|stop|status]
  Add, remove, start or stop deepstream as a service to your operating system
  ```

- Added brew cask support

You can now install easily install deepstream on your mac using `brew cask install deepstream` driven by config files within `/user/local/etc/deepstream/conf`

## Fixes

- Fix issue where certain invalid paths would return 'Invalid Type' on the server.
- Fix issue in request/response where selecting a remote server as not done uniformly.

## [2.3.7] - 2017.06.20

## Fixes

- Fix issue where using both `.0.` and `[0]` within a json path resulted in inserting into an array. However, when using other SDKs such as Java they would be treated as an Object key or array index.
- Fix issue where nested array access/manipulation didn't work via json paths.

## Compatability Issue

Due to the nature of this fix, it may result in compatability issues with applications that used json paths incorrectly ( using `.0.` intead of `[0]` ). Please ensure you change those before upgrading.

## [2.3.6] - 2017.06.12

## Fixes

- Fix for issue [#703](https://github.com/deepstreamIO/deepstream.io/issues/703)
  where record deletions were not being propogated correctly within a cluster.
- Fixes config-loading issue present in the binary release of 2.3.5.

## [2.3.5] - 2017.06.12

## Fixes

- Hardcode v3.0.0-rc1 dependency on javascript-state-machine, as v3.0.1 causes deepstream.io startup to fail

## [2.3.4] - 2017.06.02

## Fixes

- Hot path needs to store values in the correct format

## [2.3.3] - 2017.06.02

### Fixes

- Binary config files have the correct latest structure
- Fix an issue where heavy concurrent writes on the same record fail

## [2.3.2] - 2017.05.31

### Fixes

- Fixing a connection data regression where it wasn't formatted the same as pre 2.3.0

## [2.3.1] - 2017.05.30

### Fixes

- Correctly merging config options from `config.yml` file with the default options

## [2.3.0] - 2017.05.29

### Features

- Adds "storageHotPathPatterns" config option.
- Adds support for `setData()`: upsert-style record updates without requiring that a client is
  subscribed to the record. This uses a new 'CU' (Create and Update) message. The `setData()` API
  is up to 10x faster than subscribing, setting, then discarding a record.
- Support for connection endpoint plugins.

### Enhancements

- Significant performance improvements stemming from message batching.

### Miscellaneous

- Moved uws into a connection endpoint plugin.
- Explicit state-machine that initializes and closes dependencies in a well-defined order.

## [2.2.2] - 2017.05.03

### Enhancements
- Adds support for custom authentication and permissioning plugins.
- Adds support for generic plugins.

### Fixes
- Added check to ensure subscriptions are not removed from distributed state registry prematurely.

## [2.2.1] - 2017.04.24

### Enhancements

- Unsolicited RPCs now get a `INVALID_RPC_CORRELATION_ID` message

### Fixes

- RPC lifecycles have been improved and don't throw exceptions on response after a timeout by [ronag](ronag)
- Correct options now being passed into the `RuleCache`, courtesy of [ralphtheninja](ralphtheninja)

## [2.2.0] - 2017.04.08

### Enhancements

- Records now can be set with a version -1, which ignores version conflicts by [datasage](datasage)
- Delete events are now propagated in the correct order by [datasage](datasage)
- You can now request the HEAD of a record to retrieve just its version number by [datasage](datasage)
- Providers for listeners are now by default selected randomly instead of in order of subscription
- Ensure record updates are not scalar values before trying to save them in cache by [datasage](datasage)
- Long lived RPC requests now use dynamic lookups for providers rather than building the Set upfront by [ronag]{ronag}
- Huge optimization to subscription registry, where the time for registering a subscriber has been reduced from n^2 to O(n log n)

### Miscellaneous

- Deleting grunt since everything is script based


## [2.1.6] - 2017.03.29

### Miscellaneous

- Due to uws releases being pulled from NPM, we're now using uws from a git repo
- Created a separate repo [uws-dependency](https://github.com/deepstreamIO/uws-dependency) with binaries.

## [2.1.4 - 2.1.5]

- Due to problems with build resulting from uws unpublishing, these two npm packages
  have been unpublished (noop)

## [2.1.3] - 2017.02.25

### Bug Fixes

- Unsolicited message in Listening when all clients unsubscribe [#531]
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
  For example, the performance of broadcasting 100 events to 1000 subscribers
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
- We removed support for TCP and engine.io, providing huge performance gains by
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

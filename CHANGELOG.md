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

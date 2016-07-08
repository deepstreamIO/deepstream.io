# Changelog

## 1.0.0

#### Breaking Changes

If you used deepstream 0.x before you may need to change some API calls.

###### Permission Handler

In 0.x you can set a `permissionHandler` which needs to implement two functions:

- `isValidUser(connectionData, authData, callback)`
- `canPerformAction(username, message, callback)`

In deepstream 1.0 the `canPerformAction` is no longer part of the `permissionHandler` instead
it is moved to a new handler: `authenticationHandler`.

###### Plugin API

All connectors, the `permissionHandler`, `authenticationHandler` and the Logger
are implenting deepstream's plugin API which needss to export a constructor with
these feautres:

- either provide a `isReady` property which is true after calling the constructor. This makes only sense for a synchronous initialization.
- otherwise (`isReady` is false) it needs to emit an `ready` event
- for errors it should emit an `error` event

###### Logger and colors options

The color flag can't be set in the root level of the configuration anymore.
The default logger will print logs to the StdOut/StdErr in colors.
You can use the [deepstream.io-logger-winston](https://www.npmjs.com/package/deepstream.io-logger-winston) which can be configured in the config.yml file with several options.


###### Specs

TODO

###### Client

In order to connect a client to deepstream server you need also to upgrade the client.
More details in the [client changelog](https://github.com/deepstreamIO/deepstream.io-client-js/blob/master/CHANGELOG.md).

#### Enhancements

###### no process.exit on plugin initialization error or timeout

Deepstream will not longer stops your process via `process.exit()`. This
Happens before when a connector fails during initialization [#243](https://github.com/deepstreamIO/deepstream.io/issues/243) instead it will throw an error now.

Currently the API provides no event or callback to handle this error
other than subscribing to the global `uncaughtException` event.

```javascript
process.once('uncaughtException', err => {
  // err.code will equal to of these constant values:
  // C.EVENT.PLUGIN_INITIALIZATION_TIMEOUT
  // or C.EVENT.PLUGIN_INITIALIZATION_ERROR
})
```

Keep in mind that deepstream will be in an unpredictable state.
You should consider to create a new server instance of deepstream.

###### Features

- You can start deepstream via a command line interface. You find it in the _bin_ directory. It provides these subcommands:

  - `start`
  - `stop`
  - `status`
  - `install`
  - `info`
  - `hash`

  append a `--help` to see the usage.

- File based configuration
  - You can use a file based configuration instead of setting options via `ds.set(key, value)` now.
  Deepstream is shipped with a _conf_ directory which contains three files:
  - __config.yml__ this is the main config file, you can specify most of the deepstream options in that file
  - __permissions.yml__ this file can be consumed by the PermissionHandler. It's not used by default, but you can enable it in the _config.yml_
  - __users.yml__ this file can be consumed by the AuthenticationHandler. It's not used by default, but you can enable it in the _config.yml_

  For all config types support these file types: __.yml__, __.json__ and __.js__

- Passing an argument to the deepstream constructor. There are different options what you can pass:
  - not passing an argument (`undefined`)
  - passing `null` will result into loading the default configuration file in the directory _conf/config.yml_
  - passing a string which is a path to a configuration file, supported formats: __.yml__, __.json__ and __.js__
  - passing an object which defines several options, all other options will be merged from deepstream's default values

- Valve permissions rules
  - As mentioned above you can write your permission into a structured file. This file supports a special syntax, which allows you to do advanced permission checks. This syntax is called __Valve__.




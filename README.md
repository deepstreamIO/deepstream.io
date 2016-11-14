==============================================
The Open Realtime Server
----------------------------------------------
deepstream is a new type of server that syncs data and sends events across millions of clients

### Changes compared to http://deepstream.io/

 - Removed `CREATEORREAD`, `CREATE`, `DELETE`, `HAS` and `SNAPSHOT` actions. All records "exists" in the empty form `{}`. Clients should use `READ` and `UPDATE` to achieve the same functionality.
 - Removed `PATCH` action for more robust and easier conflict management. Clients should send and listen to `UPDATE` instead.
 - Changed version format to `${version}-${uuid}` for offline conflict resolution.
 - Removed `VERSION_EXISTS` and moved version and conflict management into storage layer. Highest `${version}-${uuid}` wins until conflict is resolved.
 - Removed *cache connector*. Instead all nodes have their own in-memory LRU cache. Configured using the `cacheSize` option (default 1e5).
 - Sync changes and conflict resolution from *storage connector* by listening on the `storage.on('change', (recordName, version, data)) => {}`. See https://github.com/nxtedition/deepstream.io/blob/master/examples/couchdb-storage-connector.js for an example of how to implement a storage connector.
 - Simplified code using promises instead of callbacks.

### TODO

- Re-implement `PATCH` using the parent revision.

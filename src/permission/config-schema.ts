/**
 * A basic schema for permission.json files that
 * the config validater uses
 */
export default {
  record: {
    write: true,
    read: true,
    create: true,
    delete: true,
    listen: true,
  },
  event: {
    publish: true,
    subscribe: true,
    listen: true,
  },
  rpc: {
    provide: true,
    request: true,
  },
  presence: {
    allow: true,
  },
}

import { Dictionary } from 'ts-essentials'

/**
 * A basic schema for permission.json files that
 * the config validater uses
 */

export type ConfigSchema = Dictionary<Dictionary<boolean>>

export const SCHEMA: ConfigSchema = {
  record: {
    write: true,
    read: true,
    create: true,
    delete: true,
    listen: true,
    notify: true,
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

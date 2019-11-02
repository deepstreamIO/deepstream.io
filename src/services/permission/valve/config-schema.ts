import { ConfigSchema } from '@deepstream/types'

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

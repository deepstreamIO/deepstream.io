import {
  ACTIONS_BYTE_TO_PAYLOAD as ABP,
  ACTIONS_TEXT_TO_BYTE,
  AUTH_ACTIONS as AA,
  CONNECTION_ACTIONS as CA,
  DEEPSTREAM_TYPES as TYPES,
  EVENT_ACTIONS as EA,
  MESSAGE_PART_SEPERATOR,
  MESSAGE_SEPERATOR,
  PRESENCE_ACTIONS as UA,
  RECORD_ACTIONS as RA,
  RPC_ACTIONS as PA,
  TOPIC,
  TOPIC_TEXT_TO_BYTE,
  PRESENCE_ACTIONS,
  PAYLOAD_ENCODING,
} from './constants'
import { Message } from '../../../../constants'
import { getUid } from '../../../../utils/utils'

export const correlationIdToVersion = new Map<string, number>()
export const bulkNameToCorrelationId = new Map<string, string>()

/**
 * This method tries to parse a value, and returns
 * an object containing the value or error.
 *
 * This is an optimization to avoid doing try/catch
 * inline since it incurs a massive performance hit
 * in most versions of node.
 */
function parseJSON (text: string, reviver?: any): any {
  try {
    return {
      value: JSON.parse(text, reviver),
    }
  } catch (err) {
    return {
      error: err,
    }
  }
}

const writeConfig = JSON.stringify({ writeSuccess: true })

export const parse = (rawMessage: string) => {
  const parsedMessages: any[] = []
  const rawMessages = rawMessage.split(MESSAGE_SEPERATOR)

  for (let i = 0; i < rawMessages.length; i++) {
    if (rawMessages[i].length < 3) {
      continue
    }

    const parts = rawMessages[i].split(MESSAGE_PART_SEPERATOR)

    const topic = TOPIC_TEXT_TO_BYTE[parts[0]]
    if (topic === undefined) {
      console.log('unknown topic', rawMessages[i])
      // invalid topic
      continue
    }

    let index: number = 1

    let name
    let names
    let data

    let version
    let path
    let isWriteAck

    let subscription
    let correlationId

    let isAck = false
    let isErr = false

    if (parts[index] === 'A') {
      isAck = true
      index++
    }

    if (parts[index] === 'E') {
      isErr = true
      index++
    }

    const A = ACTIONS_TEXT_TO_BYTE[topic]
    const rawAction = parts[index++]
    let action = A[rawAction]

    if (action === undefined) {
      if (
        (isErr && topic === TOPIC.RPC.BYTE) ||
        (topic === TOPIC.CONNECTION.BYTE && isAck) ||
        (topic === TOPIC.AUTH.BYTE && (isErr || isAck)) ||
        (isErr && topic === TOPIC.RECORD.BYTE)
      ) {
        // ignore
      } else {
        console.log('unknown action', parts[index - 1], rawMessages[i])
        continue
      }
    }
    if (topic === TOPIC.RECORD.BYTE) {
    /************************
    ***  RECORD
    *************************/
      name = parts[index++]
      names = [name]
      if (isErr) {
        isErr = false
        if (rawAction === 'VERSION_EXISTS') {
          action = RA.VERSION_EXISTS.BYTE
          version = (parts[index++] as unknown as number) * 1
          data = parts[index++]
          isWriteAck = parts.length - index > 1
        } else if (rawAction === 'CACHE_RETRIEVAL_TIMEOUT') {
          action = RA.CACHE_RETRIEVAL_TIMEOUT.BYTE
        } else if (rawAction === 'STORAGE_RETRIEVAL_TIMEOUT') {
          action = RA.STORAGE_RETRIEVAL_TIMEOUT.BYTE
        }
      } else if (
        action === RA.CREATEANDUPDATE.BYTE ||
        action === RA.UPDATE.BYTE ||
        action === RA.PATCH.BYTE
      ) {
        isWriteAck = (parts[parts.length - 1] === writeConfig)
        version = (parts[index++] as unknown as number) * 1

        if (action === RA.CREATEANDUPDATE.BYTE && parts.length === 7) {
          action = RA.CREATEANDPATCH.BYTE
        }

        if (action === RA.CREATEANDPATCH.BYTE || action === RA.PATCH.BYTE) {
          path = parts[index++]
        }

        if (parts.length - index === 2) {
          data = parts[parts.length - 2]
        } else {
          data = parts[index++]
        }
      } else if (
        action === RA.LISTEN_ACCEPT.BYTE ||
        action === RA.LISTEN_REJECT.BYTE ||
        action === RA.SUBSCRIPTION_FOR_PATTERN_FOUND.BYTE ||
        action === RA.SUBSCRIPTION_FOR_PATTERN_REMOVED.BYTE
      ) {
        subscription = parts[index++]
      } else if (action === RA.SUBSCRIPTION_HAS_PROVIDER.BYTE) {
        if (parts[index++] === 'F') {
          action = RA.SUBSCRIPTION_HAS_NO_PROVIDER.BYTE
        }
      }
    } else if (topic === TOPIC.EVENT.BYTE) {
    /************************
    ***  EVENT
    *************************/
      name = parts[index++]
      names = [name]
      if (
        action === EA.LISTEN_ACCEPT.BYTE ||
        action === EA.LISTEN_REJECT.BYTE ||
        action === EA.SUBSCRIPTION_FOR_PATTERN_FOUND.BYTE ||
        action === EA.SUBSCRIPTION_FOR_PATTERN_REMOVED.BYTE
      ) {
        subscription = parts[index++]
      } else if (action === EA.EMIT.BYTE) {
        data = parts[index++]
      }
    } else if (topic === TOPIC.RPC.BYTE) {
    /************************
    ***  RPC
    *************************/
      name = parts[index++]
      names = [name]
      if (isAck && action === PA.REQUEST.BYTE) {
        isAck = false
        action = PA.ACCEPT.BYTE
      }
      if (isErr) {
        isErr = false
        action = PA.REQUEST_ERROR.BYTE
        data = JSON.stringify(rawAction)
      }
      if (action !== PA.PROVIDE.BYTE && action !== PA.UNPROVIDE.BYTE) {
        correlationId = parts[index++]
      }
      if (action === PA.RESPONSE.BYTE || action === PA.REQUEST.BYTE) {
        data = parts[index++]
      }
    } else if (topic === TOPIC.PRESENCE.BYTE) {
    /************************
    ***  Presence
    *************************/
      if (action === UA.QUERY.BYTE) {
        if (parts.length === 3) {
          action = UA.QUERY_ALL.BYTE
        } else {
          correlationId = parts[index++]
          names = JSON.parse(parts[index++])
        }
      } else if (action === UA.SUBSCRIBE.BYTE || action === UA.UNSUBSCRIBE.BYTE) {
        if (parts.length === 4 && !isAck) {
          correlationId = parts[index++]
        }
        data = parts[index++]

        if (action === UA.SUBSCRIBE.BYTE && (data === 'S' || data === 'U')) {
          action = PRESENCE_ACTIONS.SUBSCRIBE_ALL.BYTE
        } else if (action === UA.UNSUBSCRIBE.BYTE && data === 'US') {
          action = PRESENCE_ACTIONS.UNSUBSCRIBE_ALL.BYTE
        } else {
          names = JSON.parse(data)
        }
      }
    } else if (topic === TOPIC.CONNECTION.BYTE) {
      /************************
      ***  Connection
      *************************/
      if (action === CA.PONG.BYTE) {
        continue
      }
      if (isAck) {
        action = CA.ACCEPT.BYTE
        isAck = false
      } else if (action === CA.REDIRECT.BYTE || action === CA.REJECTION.BYTE) {
        data = parts[index++]
      }
    } else if (topic === TOPIC.AUTH.BYTE) {
      /************************
      ***  Authentication
      *************************/
      if (isAck) {
        action = AA.AUTH_SUCCESSFUL.BYTE
      } else if (isErr) {
        if (rawAction === 'INVALID_AUTH_DATA') {
          isErr = false
          action = AA.AUTH_UNSUCCESSFUL.BYTE
        } else if (rawAction === 'TOO_MANY_AUTH_ATTEMPTS') {
          isErr = false
          action = AA.TOO_MANY_AUTH_ATTEMPTS.BYTE
        }
      }
      if (action === AA.AUTH_SUCCESSFUL.BYTE) {
        isAck = false
        data = rawAction
      } else if (action === AA.REQUEST.BYTE || action === AA.AUTH_UNSUCCESSFUL.BYTE) {
        data = parts[index++]
      }
    }

    if (names && !correlationId && version !== undefined) {
      correlationId = getUid()
      correlationIdToVersion.set(correlationId, version)
    } else if (names && !correlationId) {
      correlationId = getUid()
      bulkNameToCorrelationId.set(correlationId, names[0])
    }

    const message = JSON.parse(JSON.stringify({
      isAck,
      isErr,
      topic,
      action,
      name,
      names,
      data,

      // rpc / presence query
      correlationId,

      // subscription by listening
      subscription,

      // record
      path,
      version,
      // parsedData: null,
      isWriteAck,
    }))

    parseData(message)

    parsedMessages.push(message)
  }
  return parsedMessages
}

export const parseData = (message: Message) => {
  if (message.parsedData || !message.data) {
    return true
  }

  if (
      message.topic === TOPIC.PRESENCE.BYTE &&
      (
        message.action === PRESENCE_ACTIONS.SUBSCRIBE_ALL.BYTE ||
        message.action === PRESENCE_ACTIONS.UNSUBSCRIBE_ALL.BYTE
      )
    ) {
      // @ts-ignore
      message.parsedData = message.data
      message.data = JSON.stringify(message.data)
    }

  if (ABP[message.topic][message.action] === PAYLOAD_ENCODING.DEEPSTREAM) {
    const parsedData = convertTyped(message.data as string)
    if (parsedData instanceof Error) {
      return parsedData
    }
    message.parsedData = parsedData
    message.data = JSON.stringify(message.parsedData)
    return true
  } else {
    const res = parseJSON((message.data as string)!)
    if (res.error) {
      return res.error
    }
    message.parsedData = res.value
    return true
  }
}

/**
 * Deserializes values created by MessageBuilder.typed to
 * their original format
 */
export const convertTyped = (value: string): any => {
  if (value === 'null') {
    return null
  }

  if (value === undefined) {
    return undefined
  }

  const type = value.charAt(0)

  if (type === TYPES.STRING) {
    return value.substr(1)
  }

  if (type === TYPES.OBJECT) {
    const result = parseJSON(value.substr(1))
    if (result.value) {
      return result.value
    }
    return result.error
  }

  if (type === TYPES.NUMBER) {
    return parseFloat(value.substr(1))
  }

  if (type === TYPES.NULL || type === 'null') {
    return null
  }

  if (type === TYPES.TRUE) {
    return true
  }

  if (type === TYPES.FALSE) {
    return false
  }

  if (type === TYPES.UNDEFINED) {
    return undefined
  }

  return new Error('Unknown type')
}

export const isError = (message: any) => false

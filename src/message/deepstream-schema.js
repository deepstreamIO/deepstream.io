const C = require('../../constants/constants')

const subscribe = {
  properties: {
    topic: {
      enum: [
        C.TOPIC.EVENT,
        C.TOPIC.RPC,
        C.TOPIC.RECORD,
        C.TOPIC.PRESENCE
      ]
    },
    action: {
      enum: [
        C.ACTIONS.SUBSCRIBE,
        C.ACTIONS.UNSUBSCRIBE
      ]
    },
    name: {
      type: 'string',
      minLength: 1
    }
  },
  required: [
    'topic',
    'action',
    'name'
  ],
  additionalProperties: false
}

module.exports.event_emit = {
  properties: {
    topic: {
      const: C.TOPIC.EVENT
    },
    action: {
      const: C.ACTIONS.EVENT
    },
    name: {
      type: 'string',
      minLength: 1
    },
    data: {
      type: 'string',
      minLength: 1
    },
    parsedData: {}
  },
  required: [
    'topic',
    'action',
    'name',
    'data'
  ],
  additionalProperties: false
}

module.exports.rpc_request = {
  properties: {
    topic: {
      const: C.TOPIC.RPC
    },
    action: {
      const: C.ACTIONS.REQUEST
    },
    name: {
      type: 'string',
      minLength: 1
    },
    correlationId: {
      type: 'string',
      minLength: 1
    },
    data: {
      type: 'string',
      minLength: 1
    },
    parsedData: {}
  },
  required: [
    'topic',
    'action',
    'name',
    'correlationId',
    'data'
  ],
  additionalProperties: false
}

module.exports = {
  title: 'Deepstream Format',
  description: 'A JSON format for DeepstreamIO internal messages.',
  type: 'object',
  anyOf: [
    subscribe,
    event_emit,
    rpc_request,
    rpc_request
  ]
}

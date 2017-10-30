export * from '../protocol/binary/src/message-constants'

export enum LOG_LEVEL {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    OFF = 100
}

export enum STATES {
    STOPPED,
    LOGGER_INIT,
    PLUGIN_INIT,
    SERVICE_INIT,
    CONNECTION_ENDPOINT_INIT,
    RUNNING,
    CONNECTION_ENDPOINT_SHUTDOWN,
    SERVICE_SHUTDOWN,
    PLUGIN_SHUTDOWN,
    LOGGER_SHUTDOWN
}

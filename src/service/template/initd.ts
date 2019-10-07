export default (d: any) =>
`#!/bin/bash

### BEGIN INIT INFO
# Provides:      ${d.name}
# Required-Start:
# Required-Stop:
# Default-Start:   ${d.runLevels}
# Default-Stop:    0 1 6
# Short-Description: Start ${d.name} at boot time
# Description: Enable ${d.name} service.
### END INIT INFO

# chkconfig:   ${d.runLevels} 99 1
# description: ${d.name}

set_pid () {
    unset PID
    _PID=\`head -1 "${d.pidFile}" 2>/dev/null\`
    if [ $_PID ]; then
    kill -0 $_PID 2>/dev/null && PID=$_PID
    fi
}

restart () {
    stop
    start
}

start () {
    CNT=5

    set_pid

    if [ -z "$PID" ]; then
    echo starting ${d.name}

    if [ -e "/var/deepstream/DEEPSTREAM_SETUP" ]; then
        bash "/var/deepstream/DEEPSTREAM_SETUP"
    fi

    if [ -e "/var/deepstream/DEEPSTREAM_ENV_VARS" ]; then
        source "/var/deepstream/DEEPSTREAM_ENV_VARS"
    fi

    mkdir -p ${d.logDir}
    "${d.exec}" ${d.deepstreamArgs} >> ${d.stdOut} 2>> ${d.stdErr} &

    echo $! > "${d.pidFile}"

    while [ : ]; do
        set_pid

        if [ -n "$PID" ]; then
        echo started ${d.name}
        break
        else
        if [ $CNT -gt 0 ]; then
            sleep 1
            CNT=\`expr $CNT - 1\`
        else
            echo ERROR - failed to start ${d.name}
            break
        fi
        fi
    done
    else
    echo ${d.name} is already started
    fi
}

status () {
    set_pid

    if [ -z "$PID" ]; then
    echo ${d.name} is not running
    exit 1
    else
    echo ${d.name} is running
    exit 0
    fi
}

stop () {
    CNT=30

    set_pid

    if [ -n "$PID" ]; then
    echo stopping ${d.name}

    kill $PID

    while [ : ]; do
    set_pid

    if [ -z "$PID" ]; then
    rm "${d.pidFile}"
    echo stopped ${d.name}
    break
    else
    if [ $CNT -gt 0 ]; then
        sleep 1
        CNT=\`expr $CNT - 1\`
    else
        echo ERROR - failed to stop ${d.name}
        break
    fi
    fi
    done
    else
    echo ${d.name} is already stopped
    fi
}

case $1 in
    restart)
    restart
    ;;
    start)
    start
    ;;
    status)
    status
    ;;
    stop)
    stop
    ;;
    *)
    echo "usage: $0 <restart|start|status|stop>"
    exit 1
    ;;
esac

`

#include <uWS/uWS.h>
#include <iostream>
#include <string>
#include <chrono>

uWS::Hub hub;
int received = 0;
int connections = 0;
int logins = 0;
int messages = 0;
int batchConnect;
std::vector<uWS::WebSocket<uWS::CLIENT>> sockets;

const char EEVT[] = {'E', 31, 'E', 'V', 'T', 31, 'e', 'v', 'e', 'n', 't', 'N', 'a', 'm', 'e', 30};
const char CPO[] = {'C', 31, 'P', 'O', 30};
auto preparedMessage = uWS::WebSocket<uWS::CLIENT>::prepareMessage((char *) EEVT, sizeof(EEVT), uWS::OpCode::TEXT, false);

std::chrono::high_resolution_clock::time_point start;
int iterations = 0;
int iterationsPerPrint = 10;

void nextConnection() {
    static int addr = 1;
    hub.connect("ws://127.0.0." + std::to_string(addr) + ":6020/deepstream", nullptr, 10000);
    if (sockets.size() % 20000 == 0) {
        addr++;
    }
}

void iterate() {
    if (received != 0) {
        if (++iterations % iterationsPerPrint == 0) {
            int ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::high_resolution_clock::now() - start).count();
            std::cout << (float(ms) / iterationsPerPrint) << ", ";

            hub.getDefaultGroup<uWS::CLIENT>().close();
            return;

            start = std::chrono::high_resolution_clock::now();
        }
    } else {
        start = std::chrono::high_resolution_clock::now();
    }

    received = 0;

    for (int i = 0; i < messages; i++) {
        sockets[rand() % sockets.size()].sendPrepared(preparedMessage);
    }
}

void beginIterating() {
    hub.onMessage([](uWS::WebSocket<uWS::CLIENT> ws, char *message, size_t length, uWS::OpCode opCode) {

        if (length % 16 != 0) {
            if (length == 5) {
                ws.send(CPO, sizeof(CPO), uWS::OpCode::TEXT);
                return;
            } else {
                // this should never happen
                std::cout << "Error: Invalid message received!" << std::endl;
                exit(-1);
            }
        }

        received += length / 16;
        if (received == (connections - 1) * messages) {
            iterate();
        }
    });
    iterate();
}

int main(int argc, char *argv[])
{
    if (argc != 3) {
        std::cout << "Usage: eventBenchmark numberOfConnections numberOfEmitPublishes" << std::endl;
        return 0;
    } else {
        connections = atoi(argv[1]);
        messages = atoi(argv[2]);
    }

    batchConnect = std::min<int>(100, connections);

    // wait until DS is idle
    int port = 6020;
    char line[10240] = {};
    do {
        FILE *pipe = popen(("fuser " + std::to_string(port) + "/tcp 2> /dev/null").c_str(), "r");
        fgets(line, sizeof(line), pipe);
        pclose(pipe);
        int pid = atoi(line);
        pipe = popen(("ps -p " + std::to_string(pid) + " -o state").c_str(), "r");
        fgets(line, sizeof(line), pipe);
        pclose(pipe);
        usleep(100);
    } while (line[0] != 'S');

    hub.onMessage([](uWS::WebSocket<uWS::CLIENT> ws, char *message, size_t length, uWS::OpCode opCode) {
        const char CCH[] = {'C', 31, 'C', 'H', 30};
        const char CCHR[] = {'C', 31, 'C', 'H', 'R', 31, 'a', 'd', 'd', 'r', 30};
        const char CA[] = {'C', 31, 'A', 30};
        const char AREQ[] = {'A', 31, 'R', 'E', 'Q', 31, '{', '}', 30};
        const char AA[] = {'A', 31, 'A', 30};
        const char ES[] = {'E', 31, 'S', 31, 'e', 'v', 'e', 'n', 't', 'N', 'a', 'm', 'e', 30};

        if (!strncmp(CCH, message, std::min<int>(sizeof(CCH), length))) {
            ws.send(CCHR, sizeof(CCHR), uWS::OpCode::TEXT);
        } else if (!strncmp(CA, message, std::min<int>(sizeof(CA), length))) {
            ws.send(AREQ, sizeof(AREQ), uWS::OpCode::TEXT);
        } else if (!strncmp(AA, message, std::min<int>(sizeof(AA), length))) {
            ws.send(ES, sizeof(ES), uWS::OpCode::TEXT);
        } else if (length == 16) {

            int enable = 1;
            setsockopt(ws.getPollHandle()->io_watcher.fd, IPPROTO_TCP, TCP_NODELAY, &enable, sizeof(enable));


            sockets.push_back(ws);
            if (++logins == connections) {
                beginIterating();
            } else if (logins + batchConnect <= connections) {
                nextConnection();
            }
        } else if (length == 5) {
            ws.send(CPO, sizeof(CPO), uWS::OpCode::TEXT);
        }
    });

    hub.onError([](void *user) {
        nextConnection();
    });

    for (int i = 0; i < batchConnect; i++) {
        nextConnection();
    }
    hub.run();
}

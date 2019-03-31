# Benchmarks
This directory holds some basic benchmarks used to track the improvement of deepstream.io's performance of certain central features.

### Event benchmark
eventBenchmark.cpp measures the time it takes DS to broadcast / spread X amount of event publishes to Y amount of listeners and publishers:

```
./eventBenchmark 1000 100
```

Running the above program will wait until the (localhost) DS server is idle, establish 1000 connections and subscribe to `eventName` only to then have 100 random connections publish this event to the server. The delay from publish of all 100 events until every connection has received the correct amount of event notifications will be averaged 10 times and printed to stdout.

#### Compilation
`eventBenchmark` is written in C++11 and depends on µWS. You will need to run something like this to get it compiling (Ubuntu 16.04):

```
sudo apt update
sudo apt -y install libz-dev libssl-dev libuv1-dev g++ make
git clone https://github.com/uWebSockets/uWebSockets.git && cd uWebSockets
make
sudo make install
cd ..
make
```

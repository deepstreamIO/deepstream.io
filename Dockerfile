FROM node:10
COPY package*.json ./
RUN npm install --production \
    @deepstream/cache-redis \
    # @deepstream/cache-memcached \
    # @deepstream/cache-hazelcast \
    @deepstream/clusternode-redis \
    @deepstream/storage-mongodb \
    @deepstream/storage-rethinkdb \
    @deepstream/storage-elasticsearch \
    @deepstream/storage-postgres \
    @deepstream/logger-winston

COPY . ./

EXPOSE 6020
EXPOSE 8080
EXPOSE 9229

CMD ["node", "./bin/deepstream.js", "start", "--inspect=0.0.0.0:9229"]


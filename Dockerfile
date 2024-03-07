FROM node:18 as builder
WORKDIR /app

COPY package*.json ./

RUN npm ci
RUN npm install --omit=dev \
    @deepstream/cache-redis \
    # @deepstream/cache-memcached \
    # @deepstream/cache-hazelcast \
    @deepstream/clusternode-redis \
    @deepstream/storage-mongodb \
    @deepstream/storage-rethinkdb \
    @deepstream/storage-elasticsearch \
    @deepstream/storage-postgres \
    @deepstream/logger-winston \
    @deepstream/plugin-aws

COPY . .

RUN npm run tsc

FROM node:18
WORKDIR /usr/local/deepstream
COPY --from=builder /app/node_modules/ ./node_modules
COPY --from=builder /app/dist/ .

EXPOSE 6020
EXPOSE 8080
EXPOSE 9229

CMD ["node", "./bin/deepstream.js", "start", "--inspect=0.0.0.0:9229"]

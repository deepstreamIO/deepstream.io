FROM node:10

# RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
# RUN unzip awscliv2.zip
# RUN ./aws/install

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
    @deepstream/logger-winston \
    @deepstream/plugin-aws

COPY . ./

EXPOSE 6020
EXPOSE 8080
EXPOSE 9229

CMD ["node", "./bin/deepstream.js", "start", "--inspect=0.0.0.0:9229"]


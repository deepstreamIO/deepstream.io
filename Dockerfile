FROM node:10
COPY package*.json ./
RUN npm install --production
RUN npm install --production @deepstream/storage-rethinkdb @deepstream/cache-redis
COPY . ./

EXPOSE 6020
EXPOSE 8080
EXPOSE 9229

CMD ["node", "./bin/deepstream.js", "start", "--inspect=0.0.0.0:9229"]


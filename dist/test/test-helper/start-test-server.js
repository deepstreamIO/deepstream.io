const TestServer = require('./test-http-server');
const testServer = new TestServer(6004, () => { }, true);
testServer.on('request-received', testServer.respondWith.bind(testServer, 501, {
    serverData: {},
    clientData: { name: 'bob' }
}));
//# sourceMappingURL=start-test-server.js.map
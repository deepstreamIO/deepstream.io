const nexe = require('nexe') // eslint-disable-line

nexe.compile({
  input: 'bin/deepstream.js',
  build: (process.env.BUILD_NODE === 'true') || false,
  flags: ['--max-old-space-size=8192'],
  output: process.env.EXECUTABLE_NAME,
  target: { version: process.env.NODE_VERSION_WITHOUT_V },
  temp: 'nexe_node',
  resources: [
    'ascii-logo.txt',
    'package.json'
  ],
  ico: 'scripts/resources/deepstream.ico',
  rc: {
     CompanyName: "deepstreamHub GmbH",
     ProductName: "deepstream.io",
     FileDescription: "A Scalable Server for Realtime Applications",
     FileVersion: require('../package').version,
     ProductVersion: require('../package').version,
     OriginalFilename: "deepstream.exe",
     InternalName: "deepstream",
     LegalCopyright: "AGPL"
  }
}).then(() => {
  console.log('success')
})

const version = require('../package')
const nexe = require('nexe') // eslint-disable-line

nexe.compile({
  input: 'dist/bin/deepstream.js',
  build: false,
  flags: ['--max-old-space-size=8192'],
  output: process.env.EXECUTABLE_NAME,
  target: { version: process.env.NODE_VERSION_WITHOUT_V },
  temp: 'nexe_node',
  resources: [
    './dist/ascii-logo.txt',
    './dist/package.json'
  ],
  ico: 'scripts/resources/deepstream.ico',
  rc: {
    CompanyName: "deepstreamHub GmbH",
    ProductName: "deepstream.io",
    FileDescription: "A Scalable Server for Realtime Applications",
    FileVersion: version,
    ProductVersion: version,
    OriginalFilename: "deepstream.exe",
    InternalName: "deepstream",
    LegalCopyright: "AGPL"
  }
}).then(() => {
  console.log('success')
})

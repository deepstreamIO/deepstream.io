const nexe = require( 'nexe' );
nexe.compile( {
    flags: true,
    input: "bin/deepstream",
    output: process.env.EXECUTABLE_NAME,
    nodeVersion: process.env.NODE_VERSION_WITHOUT_V,
    nodeTempDir: "nexe_node",
    framework: "node",
    resourceFiles: [
      "ascii-logo.txt",
      "node_modules/deepstream.io-service/src/template/initd",
      "node_modules/deepstream.io-service/src/template/systemd"
    ]
  },
  error => {
    if (error) {
      return console.error( error.message )
    }
  }
)

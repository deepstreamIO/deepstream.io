// @ts-ignore
import * as dsService from '../src/service/service'
import { Command } from 'commander'
import { writeFileSync } from 'fs'
import * as jsYamlLoader from '../src/config/js-yaml-loader'
import * as fileUtil from '../src/config/file-utils'

export const nginx = (program: Command) => {
  program
    .command('nginx')
    .description('Generate an nginx config file for deepstream')

    .option('-c, --config [file]', 'The deepstream config file')
    .option('-p, --port', 'The nginx port, defaults to 8080')
    .option('-h, --host', 'The nginx host, defaults to localhost')
    .option('--ssl', 'If ssl encryption should be added')
    .option('--ssl-cert', 'The SSL Certificate')
    .option('--ssl-key', 'The SSL Key')
    .option('-o, --output [file]', 'The file to save the configuration to')
    .action(execute)
}

async function execute (this: any, action: string) {
  // @ts-ignore
  global.deepstreamCLI = this
  const { config: dsConfig } = await jsYamlLoader.loadConfigWithoutInitialization()

  if (this.ssl && (!this.sslCert || !this.sslKey)) {
    console.error('Missing --ssl-cert or/key --ssl-key options')
    process.exit(1)
  }

  const sslConfig = `
        ssl_protocols       TLSv1 TLSv1.1 TLSv1.2;
        ssl_ciphers         HIGH:!aNULL:!MD5;

        ssl_certificate ${this.sslCert};
        ssl_certificate_key ${this.sslKey};
`

  const websocketConfig = dsConfig.connectionEndpoints.reduce((result: string, endpoint: any) => {
    if (endpoint.options.urlPath) {
      return result + `
      location ${endpoint.options.urlPath} {
          proxy_pass http://deepstream;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "Upgrade";
      }
      `
    }
    return result
  }, '')

  let httpConfig = ''
  const http = dsConfig.connectionEndpoints.find((endpoint: any) => endpoint.type === 'http')
  if (http) {
    const paths = new Set([http.options.getPath, http.options.postPath, http.options.authPath])
    httpConfig = [...paths].reduce((result, path) => {
      return result + `
      location ${path} {
        proxy_pass http://deepstream;
        proxy_http_version 1.1;
      }
    `
    }, '')
  }

  const config = `
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    map $http_upgrade $connection_upgrade {
      default upgrade;
      '' close;
    }

    upstream deepstream {
      server ${dsConfig.httpServer.options.host}:${dsConfig.httpServer.options.port};
      # Insert more deepstream hosts / ports here for clustering to magically work
    }

    server {
      listen ${this.port || 8080}${this.ssl ? ' ssl' : ''};
      server_name ${this.serverName || 'localhost'};
      ${this.ssl ? sslConfig : ''}
      ${websocketConfig}
      ${httpConfig}
    }
}`

  if (this.output) {
    writeFileSync(fileUtil.lookupConfRequirePath(this.output), config, 'utf8')
    console.log(`Configuration written to ${fileUtil.lookupConfRequirePath(this.output)}`)
  } else {
    console.log(config)
  }
}

import * as jsYamlLoader from '../src/config/js-yaml-loader'
import * as commander from 'commander'
import { getDSInfo } from '../src/config/ds-info'

// work-around for:
// TS4023: Exported variable 'command' has or is using name 'local.Command'
// from external module "node_modules/commander/typings/index" but cannot be named.
// tslint:disable-next-line: no-empty-interface
export interface Command extends commander.Command { }

export const info = (program: Command) => {
  program
    .command('info')
    .description('print meta information about build and runtime')
    .option('-c, --config [file]', 'configuration file containing lib directory')
    .option('-l, --lib-dir [directory]', 'directory of libraries')
    .action(printMeta)
}

async function printMeta (this: any) {
  if (!this.libDir) {
    try {
      // @ts-ignore
      global.deepstreamCLI = this
      await jsYamlLoader.loadConfigWithoutInitialization()
      // @ts-ignore
      this.libDir = global.deepstreamLibDir
    } catch (e) {
      console.log(e)
      console.error('Please provide a libDir or a configFile to provide the relevant install information')
      process.exit(1)
    }
  }

  const dsInfo = await getDSInfo(this.libDir)
  console.log(JSON.stringify(dsInfo, null, 2))
}

import * as jsYamlLoader from '../src/config/js-yaml-loader'
import { Command } from 'commander'
import { createHash } from '../src/utils/utils'

export const hash = (program: Command) => {
  program
    .command('hash [password]')
    .description('Generate a hash from a plaintext password using file auth configuration settings')
    .option('-c, --config [file]', 'configuration file containing file auth and hash settings')
    .action(action)
}

async function action (this: any, password: string) {
  // @ts-ignore
  global.deepstreamCLI = this
  const config = (await jsYamlLoader.loadConfigWithoutInitialization()).config

  const fileAuthHandlerConfig = config.auth.find((auth) => auth.type === 'file')

  if (fileAuthHandlerConfig === undefined) {
    console.error('Error: Can only use hash with file authentication as auth type')
    return process.exit(1)
  }

  if (!fileAuthHandlerConfig.options.hash) {
    console.error('Error: Can only use hash with file authentication')
    return process.exit(1)
  }

  fileAuthHandlerConfig.options.path = ''

  if (!password) {
    console.error('Error: Must provide password to hash')
    return process.exit(1)
  }

  const { iterations, keyLength, hash: algorithm } = fileAuthHandlerConfig.options
  try {
    const { hash: generatedHash, salt } = await createHash(password, { iterations, keyLength, algorithm })
    console.log(`Password hash: ${generatedHash.toString('base64')}${salt}`)
  } catch (e) {
    console.error('Hash could not be created', e)
    process.exit(1)
  }
}

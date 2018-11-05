import * as path from 'path'
const proxyquire = require('proxyquire').noPreserveCache()
const utils = require('../../src/utils/utils')
const jsYamlLoader = require('../../src/config/js-yaml-loader')

function setUpStub (fileExists?, fileContent?) {
  const fileMock: any = {}
  if (typeof fileExists !== 'undefined') {
    fileMock.fileExistsSync = function () {
      return !!fileExists
    }
  }
  const fsMock: any = {}
  if (typeof fileContent !== 'undefined') {
    fsMock.readFileSync = function () {
      return fileContent
    }
  }

  const configLoader = proxyquire('../../src/config/js-yaml-loader', {
    './file-utils': fileMock,
    'fs': fsMock
  })
  spyOn(fileMock, 'fileExistsSync').and.callThrough()
  spyOn(fsMock, 'readFileSync').and.callThrough()
  return {
    configLoader,
    fileMock,
    fsMock
  }
}

describe('js-yaml-loader', () => {
  afterAll(() => {
    global.deepstreamConfDir = null
    global.deepstreamLibDir = null
    global.deepstreamCLI = null
  })

  describe('js-yaml-loader loads and parses json files', () => {
    const jsonLoader = {
      load: jsYamlLoader.readAndParseFile
    }

    it('initialises the loader', () => {
      expect(typeof jsonLoader.load).toBe('function')
    })

    it('errors if invoked with an invalid path', done => {
      jsonLoader.load(null, (err, result) => {
        expect(err.toString()).toContain('string')
        expect(result).toBeUndefined()
        done()
      })
    })

    it('successfully loads and parses a valid JSON file', done => {
      jsonLoader.load('./test/test-configs/basic-valid-json.json', (err, result) => {
        expect(err).toBe(null)
        expect(result).toEqual({ pet: 'pug' })
        done()
      })
    })

    it('errors when trying to load non existant file', done => {
      jsonLoader.load('./test/test-configs/does-not-exist.json', (err, result) => {
        expect(err.toString()).toContain('no such file or directory')
        expect(result).toBeUndefined()
        done()
      })
    })

    it('errors when trying to load invalid json', done => {
      jsonLoader.load('./test/test-configs/broken-json-config.json', (err, result) => {
        expect(err.toString()).toContain('Unexpected token')
        expect(result).toBeUndefined()
        done()
      })
    })
  })

  describe('js-yaml-loader', () => {
    it('loads the default yml file', () => {
      const loader = jsYamlLoader
      const result = loader.loadConfig()
      let defaultYamlConfig = result.config

      expect(result.file).toEqual(path.join('conf', 'config.yml'))

      expect(defaultYamlConfig.serverName).toEqual(jasmine.any(String))
      defaultYamlConfig = utils.merge(defaultYamlConfig, {
        permission: { type: 'none', options: null },
        permissionHandler: null,
        authenticationHandler: null,
        plugins: null,
        serverName: null,
        logger: null
      })
      expect(defaultYamlConfig).not.toBe(null)
    })

    it('tries to load yaml, js and json file and then default', () => {
      const stub = setUpStub(false)

      expect(() => {
        stub.configLoader.loadConfig()
      }).toThrow()

      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledTimes(28)

      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledWith(path.join('conf', 'config.js'))
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledWith(path.join('conf', 'config.json'))
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledWith(path.join('conf', 'config.yml'))

      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledWith('/etc/deepstream/config.js')
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledWith('/etc/deepstream/config.json')
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledWith('/etc/deepstream/config.yml')
    })

    it('load a custom yml file path', () => {
      const stub = setUpStub()
      const config = stub.configLoader.loadConfig('./test/test-configs/config.yml').config
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledTimes(1)
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledWith('./test/test-configs/config.yml')
      expect(config.serverName).toBeDefined()
      expect(config.serverName).not.toEqual('')
      expect(config.serverName).not.toEqual('UUID')
      expect(config.port).toEqual(1337)
      expect(config.host).toEqual('1.2.3.4')
      expect(config.colors).toEqual(false)
      expect(config.showLogo).toEqual(false)
      // TODO
      // expect(config.logLevel).toEqual(C.LOG_LEVEL.ERROR)
    })

    it('loads a missing custom yml file path', () => {
      const stub = setUpStub()
      expect(() => {
        stub.configLoader.loadConfig(null, { config: './test/test-configs/does-not-exist.yml' })
      }).toThrowError('Configuration file not found at: ./test/test-configs/does-not-exist.yml')
    })

    it('load a custom json file path', () => {
      const stub = setUpStub(true, JSON.stringify({ port: 1001 }))
      const config = stub.configLoader.loadConfig(null, { config: './foo.json' }).config
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledTimes(1)
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledWith('./foo.json')
      expect(config.port).toEqual(1001)
    })

    it('load a custom js file path', () => {
      const stub = setUpStub()

      let config = stub.configLoader.loadConfig(null, { config: './test/test-configs/config.js' }).config
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledTimes(1)
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledWith('./test/test-configs/config.js')
      expect(config.port).toEqual(1002)

      config = stub.configLoader.loadConfig(null, { config: path.join(process.cwd(), 'test/test-configs/config.js') }).config
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledTimes(2)
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledWith(path.join(process.cwd(), 'test/test-configs/config.js'))
      expect(config.port).toEqual(1002)
    })

    it('fails if the custom file format is not supported', () => {
      const stub = setUpStub(true, 'content doesnt matter here')
      expect(() => {
        // tslint:disable-next-line:no-unused-expression
        stub.configLoader.loadConfig(null, { config: './config.foo' }).config
      }).toThrowError('.foo is not supported as configuration file')
    })

    it('fails if the custom file was not found', () => {
      const stub = setUpStub(false)
      expect(() => {
        // tslint:disable-next-line:no-unused-expression
        stub.configLoader.loadConfig(null, { config: './not-existing-config' }).config
      }).toThrowError('Configuration file not found at: ./not-existing-config')
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledTimes(1)
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledWith('./not-existing-config')
    })

    it('fails if the yaml file is invalid', () => {
      const stub = setUpStub()
      expect(() => {
        // tslint:disable-next-line:no-unused-expression
        stub.configLoader.loadConfig(null, { config: './test/test-configs/config-broken.yml' }).config
      }).toThrowError(/asdsad: ooops/)
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledTimes(1)
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledWith('./test/test-configs/config-broken.yml')
    })

    it('fails if the js file is invalid', () => {
      const stub = setUpStub()
      expect(() => {
        // tslint:disable-next-line:no-unused-expression
        stub.configLoader.loadConfig(null, { config: './test/test-configs/config-broken.js' }).config
      }).toThrowError(/foobarBreaksIt is not defined/)
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledTimes(1)
      expect(stub.fileMock.fileExistsSync).toHaveBeenCalledWith('./test/test-configs/config-broken.js')
    })
  })

  describe('supports environment variable substitution', () => {
    let configLoader

    beforeAll(() => {
      process.env.ENVIRONMENT_VARIABLE_TEST_1 = 'an_environment_variable_value'
      process.env.ENVIRONMENT_VARIABLE_TEST_2 = 'another_environment_variable_value'
      process.env.EXAMPLE_HOST = 'host'
      process.env.EXAMPLE_PORT = '1234'
      configLoader = jsYamlLoader
    })

    it('does environment variable substitution for yaml', () => {
      const config = configLoader.loadConfig(null, { config: './test/test-configs/config.yml' }).config
      expect(config.environmentvariable).toBe('an_environment_variable_value')
      expect(config.another.environmentvariable).toBe('another_environment_variable_value')
      // expect(config.thisenvironmentdoesntexist).toBe('DOESNT_EXIST')
      expect(config.multipleenvs).toBe('host:1234')
    })

    it('does environment variable substitution for json', () => {
      const config = configLoader.loadConfig(null, { config: './test/test-configs/json-with-env-variables.json' }).config
      expect(config.environmentvariable).toBe('an_environment_variable_value')
      expect(config.another.environmentvariable).toBe('another_environment_variable_value')
      // expect(config.thisenvironmentdoesntexist).toBe('DOESNT_EXIST')
      expect(config.multipleenvs).toBe('host:1234')
    })
  })

  describe('merges in deepstreamCLI options', () => {
    let configLoader

    beforeAll(() => {
      global.deepstreamCLI = {
        port: 5555
      }
      configLoader = jsYamlLoader
    })

    afterAll(() => {
      delete process.env.deepstreamCLI
    })

    it('does cli substitution', () => {
      const config = configLoader.loadConfig().config
      expect(config.connectionEndpoints.websocket.options.port).toEqual(5555)
    })
  })

  describe('load plugins by relative path property', () => {
    let services
    beforeAll(() => {
      const fileMock = {
        fileExistsSync () {
          return true
        }
      }
      const fsMock = {
        readFileSync (filePath) {
          if (filePath === './config.json') {
            return `{
              "plugins": {
                "logger": {
                  "path": "./logger"
                },
                "cache": {
                  "path": "./cache",
                  "options": { "foo": 3, "bar": 4 }
                }
              }
            }`
          }
          throw new Error(`should not require any other file: ${filePath}`)

        }
      }
      const loggerModule = function (options) { return options }
      loggerModule['@noCallThru'] = true
      loggerModule['@global'] = true
      class CacheModule {
        public options: any
        constructor (options) {
          this.options = options
        }
      }
      CacheModule['@noCallThru'] = true
      CacheModule['@global'] = true
      const configLoader = proxyquire('../../src/config/js-yaml-loader', {
        'fs': fsMock,
        './file-utils': fileMock,
        [path.resolve('./logger')]: loggerModule,
        [path.resolve('./cache')]: CacheModule
      })
      services = configLoader.loadConfig(null, { config: './config.json' }).services
    })

    it('load plugins', () => {
      expect(services.cache.options).toEqual({ foo: 3, bar: 4 })
    })
  })

  describe('load plugins by path property (npm module style)', () => {
    let services
    beforeAll(() => {
      const fileMock = {
        fileExistsSync () {
          return true
        }
      }
      const fsMock = {
        readFileSync (filePath) {
          if (filePath === './config.json') {
            return `{
              "plugins": {
                "cache": {
                  "path": "foo-bar-qox",
                  "options": { "foo": 3, "bar": 4 }
                }
              }
            }`
          }
          throw new Error(`should not require any other file: ${filePath}`)

        }
      }
      // tslint:disable-next-line:max-classes-per-file
      class FooBar {
        public options: any
        constructor (options) {
          this.options = options
        }
      }
      FooBar['@noCallThru'] = true
      FooBar['@global'] = true
      const configLoader = proxyquire('../../src/config/js-yaml-loader', {
        'fs': fsMock,
        './file-utils': fileMock,
        'foo-bar-qox': FooBar
      })
      services = configLoader.loadConfig(null, { config: './config.json' }).services
    })

    it('load plugins', () => {
      expect(services.cache.options).toEqual({ foo: 3, bar: 4 })
    })
  })

  describe('load plugins by name with a name convention', () => {
    let services
    beforeAll(() => {
      const fileMock = {
        fileExistsSync () {
          return true
        }
      }
      const fsMock = {
        readFileSync (filePath) {
          if (filePath === './config.json') {
            return `{
              "plugins": {
                "cache": {
                  "name": "super-cache",
                  "options": { "foo": 5, "bar": 6 }
                },
                "storage": {
                  "name": "super-storage",
                  "options": { "foo": 7, "bar": 8 }
                }
              }
            }`
          }
          throw new Error(`should not require any other file: ${filePath}`)

        }
      }
      // tslint:disable-next-line:max-classes-per-file
      class SuperCache {
        public options: any
        constructor (options) {
          this.options = options
        }
      }
      SuperCache['@noCallThru'] = true
      SuperCache['@global'] = true
      // tslint:disable-next-line:max-classes-per-file
      class SuperStorage {
        public options: any
        constructor (options) {
          this.options = options
        }
      }
      SuperStorage['@noCallThru'] = true
      SuperStorage['@global'] = true
      const configLoader = proxyquire('../../src/config/js-yaml-loader', {
        'fs': fsMock,
        './file-utils': fileMock,
        'deepstream.io-cache-super-cache': SuperCache,
        'deepstream.io-storage-super-storage': SuperStorage
      })
      services = configLoader.loadConfig(null, {
        config: './config.json'
      }).services
    })

    it('load plugins', () => {
      expect(services.cache.options).toEqual({ foo: 5, bar: 6 })
      expect(services.storage.options).toEqual({ foo: 7, bar: 8 })
    })
  })

  describe('load plugins by name with a name convention with lib prefix', () => {
    let services
    beforeAll(() => {
      const fileMock = {
        fileExistsSync () {
          return true
        }
      }
      const fsMock = {
        readFileSync (filePath) {
          if (filePath === './config.json') {
            return `{
              "plugins": {
                "cache": {
                  "name": "super-cache",
                  "options": { "foo": -1, "bar": -2 }
                },
                "storage": {
                  "name": "super-storage",
                  "options": { "foo": -3, "bar": -4 }
                }
              }
            }`
          }
          throw new Error(`should not require any other file: ${filePath}`)

        }
      }
      // tslint:disable-next-line:max-classes-per-file
      class SuperCache {
        public options: any
        constructor (options) {
          this.options = options
        }
      }
      SuperCache['@noCallThru'] = true
      SuperCache['@global'] = true
      // tslint:disable-next-line:max-classes-per-file
      class SuperStorage {
        public options: any
        constructor (options) {
          this.options = options
        }
      }
      SuperStorage['@noCallThru'] = true
      SuperStorage['@global'] = true
      // tslint:disable-next-line:max-classes-per-file
      class HTTPMock {
        public options: any
        constructor (options) {
          this.options = options
        }
      }
      HTTPMock['@noCallThru'] = true
      HTTPMock['@global'] = true
      const configLoader = proxyquire('../../src/config/js-yaml-loader', {
        'fs': fsMock,
        './file-utils': fileMock,
        [path.resolve(process.cwd(), 'foobar', 'deepstream.io-cache-super-cache')]: SuperCache,
        [path.resolve(process.cwd(), 'foobar', 'deepstream.io-storage-super-storage')]: SuperStorage,
        [path.resolve(process.cwd(), 'foobar', 'deepstream.io-connection-http')]: HTTPMock
      })
      services = configLoader.loadConfig(null, {
        config: './config.json',
        libDir: 'foobar'
      }).services
    })

    it('load plugins', () => {
      expect(services.cache.options).toEqual({ foo: -1, bar: -2 })
      expect(services.storage.options).toEqual({ foo: -3, bar: -4 })
    })
  })

  describe('load plugins by name with a name convention with an absolute lib prefix', () => {
    let services
    beforeAll(() => {
      const fileMock = {
        fileExistsSync () {
          return true
        }
      }
      const fsMock = {
        readFileSync (filePath) {
          if (filePath === './config.json') {
            return `{
              "plugins": {
                "cache": {
                  "name": "super-cache",
                  "options": { "foo": -1, "bar": -2 }
                },
                "storage": {
                  "name": "super-storage",
                  "options": { "foo": -3, "bar": -4 }
                }
              }
            }`
          }
          throw new Error(`should not require any other file: ${filePath}`)

        }
      }
      // tslint:disable-next-line:max-classes-per-file
      class SuperCache {
        public options: any
        constructor (options) {
          this.options = options
        }
      }
      SuperCache['@noCallThru'] = true
      SuperCache['@global'] = true
      // tslint:disable-next-line:max-classes-per-file
      class SuperStorage {
        public options: any
        constructor (options) {
          this.options = options
        }
      }
      SuperStorage['@noCallThru'] = true
      SuperStorage['@global'] = true
      // tslint:disable-next-line:max-classes-per-file
      class HTTPMock {
        public options: any
        constructor (options) {
          this.options = options
        }
      }
      HTTPMock['@noCallThru'] = true
      HTTPMock['@global'] = true
      const configLoader = proxyquire('../../src/config/js-yaml-loader', {
        'fs': fsMock,
        './file-utils': fileMock,
        [path.resolve('/foobar', 'deepstream.io-cache-super-cache')]: SuperCache,
        [path.resolve('/foobar', 'deepstream.io-storage-super-storage')]: SuperStorage,
        [path.resolve('/foobar', 'deepstream.io-connection-http')]: HTTPMock
      })
      services = configLoader.loadConfig(null, {
        config: './config.json',
        libDir: '/foobar'
      }).services
    })

    it('load plugins', () => {
      expect(services.cache.options).toEqual({ foo: -1, bar: -2 })
      expect(services.storage.options).toEqual({ foo: -3, bar: -4 })
    })
  })
})

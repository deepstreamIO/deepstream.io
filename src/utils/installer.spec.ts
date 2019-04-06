import {expect} from 'chai'
import * as path from 'path'
const pj = path.join
const proxyquire = require('proxyquire').noPreserveCache()
const mkdirp = require('mkdirp')
import { EventEmitter } from 'events'
const Stream = require('stream')
import {spy} from 'sinon'
const noop = function () {}

// Needle mock
class Needle extends EventEmitter {
  public response1: any
  public response2: any

  constructor (response1, response2?) {
    super()
    this.response1 = response1
    this.response2 = response2
  }
  public get (urlPath, options, callback) {
    if (urlPath.indexOf('https://api') !== -1) {
      return this.response1(urlPath, options, callback)
    }
    return this.response2(urlPath, options, callback)

  }
}

function createZipMock (cb1, cb2) {
  if (cb1 == null) { cb1 = noop }
  if (cb2 == null) { cb2 = noop }
  // tslint:disable-next-line:max-classes-per-file
  class ZipMock {
    constructor (filePath) {
      cb1(filePath)
    }
    public extractAllTo (directory, overwrite) {
      cb2(directory, overwrite)
    }
  }
  return ZipMock
}

const dummyWritedStream = function (options?: any) {
  return function () {
    const stream = new Stream.Writable()
    stream._write = function (chunk, enc, next) {
      if (options && options.error) {
        stream.emit('error', options.error)
      } else {
        next()
      }
    }
    return stream
  }
}

describe('installer', () => {
  process.env.QUIET = '1' // do not print out to stdout
  const archiveUrl = 'https://github.com/deepstream.io-cache-redis-test.zip'
  const assets = [
    { name: 'windows', browser_download_url: archiveUrl },
    { name: 'linux', browser_download_url: archiveUrl },
    { name: 'mac', browser_download_url: archiveUrl }
  ]

  it('handle network error', (done) => {
    const needleMock = new Needle(
      // request handler for fetching all releases
      (urlPath, options, callback) => callback(new Error('network-dummy-error'))
    )
    needleMock['@noCallThru'] = true
    const installer = proxyquire('./installer', {
      needle: needleMock
    }).installer

    installer({ type: 'foo', name: 'bar' }, (error) => {
      expect(error.toString()).to.contain('network-dummy-error')
      done()
    })
  })

  it('connector not found', (done) => {
    const needleMock = new Needle(
      // request handler for fetching all releases
      (urlPath, options, callback) => callback(null, { statusCode: 404 })
    )
    needleMock['@noCallThru'] = true
    const installer = proxyquire('./installer', {
      needle: needleMock
    }).installer

    installer({ type: 'foo', name: 'bar' }, (error) => {
      expect(error.toString()).to.contain('Not found')
      expect(error.toString()).to.contain('see available')
      done()
    })
  })

  it('connector found but not the version', (done) => {
    const needleMock = new Needle(
      // request handler for fetching all releases
      (urlPath, options, callback) => callback(null, {
        statusCode: 200,
        body: [{ tag_name: '1.2.1', assets }]
      })
    )
    needleMock['@noCallThru'] = true
    const installer = proxyquire('./installer', {
      needle: needleMock
    }).installer

    installer({ type: 'foo', name: 'bar', version: '1.2.3' }, (error) => {
      expect(error.toString()).to.contain('1.2.3 not found')
      expect(error.toString()).to.contain('deepstream.io-foo-bar/releases')
      done()
    })
  })

  it('connector found but not the platform', (done) => {
    const needleMock = new Needle(
      // request handler for fetching all releases
      (urlPath, options, callback) => callback(null, {
        statusCode: 200,
        body: [{ tag_name: '1.2.3',
          assets: [
            { name: 'other-os', browser_download_url: archiveUrl }
          ] }]
      })
    )
    needleMock['@noCallThru'] = true
    const installer = proxyquire('./installer', {
      needle: needleMock
    }).installer

    installer({ type: 'foo', name: 'bar', version: '1.2.3' }, (error) => {
      expect(error.toString()).to.contain('platform')
      expect(error.toString()).to.contain('deepstream.io-foo-bar/releases')
      done()
    })
  })

  it('error while downloading the archive', (done) => {
    const fsMock = {
      createWriteStream: dummyWritedStream()
    }
    const needleMock = new Needle(
      // request handler for fetching all releases
      (urlPath, options, callback) => callback(null, {
        statusCode: 200,
        body: [{ tag_name: '1.2.3', assets }]
      }),
      // request handler for all other requests, not starting with 'https://api'
      (urlPath, options, callback) => callback(new Error('dummy-stream-read-error'))
    )
    spy(mkdirp, 'sync')
    needleMock['@noCallThru'] = true
    const installer = proxyquire('./installer', {
      needle: needleMock,
      fs: fsMock
    }).installer

    installer({ type: 'foo', name: 'bar', version: '1.2.3' }, (error) => {
      expect(error.toString()).to.contain('dummy-stream-read-error')
      done()
    })
  })

  it('error while extracting the archive', (done) => {
    const fsMock = {
      createWriteStream: dummyWritedStream()
    }
    const childProcessMock = {
      execSync () { throw new Error('Could not extract archive') }
    }
    const needleMock = new Needle(
      // request handler for fetching all releases
      (urlPath, options, callback) => callback(null, {
        statusCode: 200,
        body: [{ tag_name: '1.2.3', assets }]
      }),
      // request handler for all other requests, not starting with 'https://api'
      (urlPath, options, callback) => callback(null, { body: '' })
    )
    // spy(mkdirp, 'sync')
    needleMock['@noCallThru'] = true
    const installer = proxyquire('./installer', {
      needle: needleMock,
      fs: fsMock,
      child_process: childProcessMock
    }).installer

    installer({ type: 'foo', name: 'bar', version: '1.2.3', verbose: true }, (error) => {
      expect(error.toString()).to.contain('extract')
      done()
    })
  })

  it.skip('downloads a connector and extract it', (done) => {
    const fsMock = {
      readFileSync () {
        return 'config:\n host: localhost\n port: 1234'
      },
      createWriteStream: dummyWritedStream()
    }
    const needleMock = new Needle(
      // request handler for fetching all releases
      (urlPath, options, callback) => callback(null, {
        statusCode: 200,
        body: [{ tag_name: '1.0.0', assets }]
      }),
      // request handler for all other requests, not starting with 'https://api'
      (urlPath, options, callback) => callback(null, { body: '' })
    )
    const zipConstructor = spy()
    const zipExtractor = spy()
    const zipMock = createZipMock(zipConstructor, zipExtractor)
    // tslint:disable-next-line:variable-name
    const child_processMock = {
      execSync () {}
    }

    spy(needleMock, 'get')
    // spy(mkdirp, 'sync')
    spy(fsMock, 'readFileSync')
    spy(fsMock, 'createWriteStream')
    spy(child_processMock, 'execSync')
    needleMock['@noCallThru'] = true
    const installer = proxyquire('./installer', {
      'needle': needleMock,
      'adm-zip': zipMock,
      'fs': fsMock,
      'child_process': child_processMock
    }).installer

    const installOptions = {
      type: 'cache',
      name: 'redis',
      version: null,
      dir: null
    }

    installer(installOptions, (error) => {
      expect(error).to.equal(undefined)
      // fetch all releases
      expect((needleMock.get as any).calls.argsFor(0)[0])
        .to.deep.equal('https://api.github.com/repos/deepstreamIO/deepstream.io-cache-redis/releases')
      // fetch archive
      expect((needleMock.get as any).calls.argsFor(1)[0])
        .to.deep.equal('https://github.com/deepstream.io-cache-redis-test.zip')
      // save archive
      expect(mkdirp.sync.calls.argsFor(0)[0]).to.deep.equal('lib')
      expect((fsMock.createWriteStream as any).calls.argsFor(0)[0])
        .to.deep.equal(pj('lib', 'cache-redis-test-1.0.0.zip'))
      // prepare extract archive
      if ((child_processMock.execSync as any).calls.count()) {
        expect((child_processMock.execSync as any).calls.argsFor(0)[0])
          .to.deep.equal('mkdir -p lib/deepstream.io-cache-redis && ' +
          'tar -xzf lib/cache-redis-test-1.0.0.zip -C lib/deepstream.io-cache-redis')
      } else {
        expect(zipConstructor.lastCall.args[0]).to.deep.equal(pj('lib', 'cache-redis-test-1.0.0.zip'))
        expect(zipExtractor.lastCall.args).to.deep.equal([pj('lib', 'deepstream.io-cache-redis'), true])
      }
      // show example config
      expect((fsMock.readFileSync as any).calls.argsFor(0)[0])
        .to.deep.equal(pj('lib', 'deepstream.io-cache-redis', 'example-config.yml'))
      done()
    })
  })
})

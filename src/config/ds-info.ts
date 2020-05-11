import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as glob from 'glob'

export const getDSInfo = (libDir?: string) => {
    let meta
    let pkg
    try {
        meta = require('../../meta.json')
    } catch (err) {
        // if deepstream is not installed as binary (source or npm)
        pkg = require('../../package.json')
        meta = {
            deepstreamVersion: pkg.version,
            ref: pkg.gitHead || pkg._resolved || 'N/A',
            buildTime: 'N/A'
        }
    }
    meta.platform = os.platform()
    meta.arch = os.arch()
    meta.nodeVersion = process.version
    if (libDir) {
        fetchLibs(libDir, meta)
    }
    return meta
}

const fetchLibs = (libDir: string, meta: any) => {
    const directory = libDir || 'lib'
    const files = glob.sync(path.join(directory, '*', 'package.json'))
    meta.libs = files.map((filePath) => {
        const pkg = fs.readFileSync(filePath, 'utf8')
        const object = JSON.parse(pkg)
        return `${object.name}:${object.version}`
    })
}

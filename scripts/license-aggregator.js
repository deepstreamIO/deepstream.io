#!/usr/bin/env node
const path = require('path')
const fs = require('fs')
const child_process = require('child_process')
const async = require('async')

const PRE_HEADER = fs.readFileSync('LICENSE', 'utf8')
const HEADER = `
This license applies to all parts of deepstream.io that are not externally
maintained libraries.

The externally maintained libraries used by deepstream.io are:
`
const emptyState  = "see MISSING LICENSES at the bottom of this file"


if (path.basename(process.cwd()) === 'scripts') {
  console.error('Run this script from the project root!')
  process.exit(0)
}

child_process.execSync('npm list --production --json > licenses.json')
const mainModule = require('../licenses.json')

const moduleNames = []
traverseDependencies(mainModule)

function traverseDependencies(module) {
  for (let dependency in module.dependencies) {
    moduleNames.push(dependency)
    traverseDependencies(module.dependencies[dependency])
  }
}

// This source code is taken from the 'license-spelunker' npm module, it was patched

/*
The MIT License (MIT)

Copyright (c) 2013 Mike Brevoort

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
var projPath = path.resolve(process.argv[2] || '.')
console.error('Project Path', projPath)
var topPkg = require(path.join(projPath, 'package.json'))

var modules = []
var count = 0

doLevel(projPath)


function doLevel(nodePath) {
  var pkg = require(path.join(nodePath, 'package.json'))
  if (topPkg.name !== pkg.name && moduleNames.indexOf(pkg.name) === -1) {
    return
  }
  var nodeModulesPath = path.join(nodePath, 'node_modules')
  count ++

  //console.error('package.json license', pkg.license)

  fs.exists(nodeModulesPath, function (dirExists) {
    if (dirExists) {
      fs.readdir(nodeModulesPath, function (err, files) {
        if (err) throw err
        files = files.map(function (f) { return path.join(nodeModulesPath, f) })
        async.filter(files, isModuleDirectory, (err, directories) => {
          directories.forEach(doLevel)
        })
      })
    }
  })

  licenseText(nodePath, function (license) {
    var licenceProperty = pkg.license || pkg.licenses
    var licenceUrl = (pkg.license || {}).url
    if ((licenceProperty || {}).type) {
      licenceProperty = licenceProperty.type
      licenceUrl = licenceProperty[0].url
    }
    if (((licenceProperty || {})[0] || []).type) {
      licenceProperty = licenceProperty[0].type
      licenceUrl = licenceProperty[0].url
    }

    if (pkg.name !== topPkg.name) {
      modules.push({
        name: pkg.name,
        version: pkg.version,
        url: 'http://npmjs.org/package/' + pkg.name,
        localPath: path.relative(projPath,nodePath),
        pkgLicense: licenceProperty,
        licenceUrl: licenceUrl,
        license: license
      })
    }
    count--

    if (count == 0) {
      var noLicenseFile = modules.filter(function (m) { return m.license === emptyState })
      var andNoPkgJsonLicense = noLicenseFile.filter(function (m) { return !m.pkgLicense })

      // Status report
      // Write to StdErr
      console.error('LICENSE FILE REPORT FOR ', topPkg.name)
      console.error(modules.length + ' nested dependencies')
      console.error(noLicenseFile.length +  ' without identifiable license text')
      console.error(andNoPkgJsonLicense.length +  ' without even a package.json license declaration', '\n\n')

      // Write to StdOut
      console.log(PRE_HEADER)
      console.log('')
      console.log(HEADER)
      modules.forEach(function(m) {
        console.log((modules.indexOf(m)+1) + ' ----------------------------------------------------------------------------')
        console.log(m.name + '@' + m.version)
        console.log(m.url)
        console.log(m.localPath)
        if (m.pkgLicense) console.log('From package.json license property:', JSON.stringify(m.pkgLicense))
        if (m.licenceUrl) console.log('From package.json url property:', JSON.stringify(m.licenceUrl))
        console.log('')
        console.log(m.license)
        console.log('')
      })
    }
  })
}

function licenseText (nodePath, cb) {
  var possibleLicensePaths = [
    path.join(nodePath, 'LICENSE'),
    path.join(nodePath, 'LICENCE'),
    path.join(nodePath, 'LICENSE.md'),
    path.join(nodePath, 'LICENSE.txt'),
    path.join(nodePath, 'LICENSE-MIT'),
    path.join(nodePath, 'LICENSE-BSD'),
    path.join(nodePath, 'LICENSE.BSD'),
    path.join(nodePath, 'MIT-LICENSE.txt'),
    path.join(nodePath, 'Readme.md'),
    path.join(nodePath, 'README.md'),
    path.join(nodePath, 'README.markdown')
  ]

  async.reduceRight(possibleLicensePaths, emptyState, function (state, licensePath, reduceCb) {
    var isAReadme = (licensePath.toLowerCase().indexOf('/readme') > 0)

    // if we already found a licnese, don't bother looking at READMEs
    if (state !== emptyState && isAReadme) return reduceCb (null, state)

    fs.exists(licensePath, function (exists) {
      if (!exists) return reduceCb(null, state)
      fs.readFile(licensePath, { encoding: 'utf8' }, function (err, text) {
        if (err) return logError(err, reduceCb)(err, state)

        if (isAReadme) {
          var match = text.match(/\n[# ]*license[ \t]*\n/i)
          if (match) {
            //console.log(match.input.substring(match.index))
            return reduceCb (null, 'FROM README:\n' + match.input.substring(match.index))
          }
          else {
            return reduceCb(null, state)
          }
        }
        else {
          return reduceCb (null, text)
        }


        return reduceCb (null, text)
      })

    })
  }, function (err, license) {
    if (err) return cb('ERROR FINDING LICENSE FILE ' + err )
    cb (license)
  })
}

function isModuleDirectory (dirPath, cb) {
  var pkgPath = path.join(dirPath, 'package.json')
  fs.stat(dirPath, function (err, stat) {
    if (err) return logError(err, cb)(false)

    var isdir = stat.isDirectory()
    if (isdir) {
      fs.access(pkgPath, (err) => {
        cb(null, !err)
      })
    }
    else {
      cb(false)
    }
  })
}

function logError(err, cb) {
  console.error('ERROR', err)
  return cb
}

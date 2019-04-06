import 'mocha'
import { expect } from 'chai'

import * as fileUtils from './file-utils'
const path = require('path')

describe('fileUtils tests', () => {
  it('check cases with no or a relative prefix', () => {
        // node style path (no dot at the start and not absolute path)
    expect(fileUtils.lookupRequirePath('foo-bar')).to.deep.equal('foo-bar')
    expect(fileUtils.lookupRequirePath('dir/foo-bar')).to.deep.equal('dir/foo-bar')
    expect(fileUtils.lookupRequirePath('foo-bar', 'pre')).to.deep.equal(path.resolve('pre', 'foo-bar'))
    expect(fileUtils.lookupRequirePath('dir/foo-bar', 'pre')).to.deep.equal(path.resolve('pre', 'dir', 'foo-bar'))

        // use an absolute path for the fileUtilsname
    expect(fileUtils.lookupRequirePath('/usr/foo-bar')).to.deep.equal('/usr/foo-bar')
    expect(fileUtils.lookupRequirePath('/usr/dir/foo-bar')).to.deep.equal('/usr/dir/foo-bar')
    expect(fileUtils.lookupRequirePath('/usr/foo-bar', 'pre')).to.deep.equal('/usr/foo-bar')
    expect(fileUtils.lookupRequirePath('/usr/dir/foo-bar', 'pre')).to.deep.equal('/usr/dir/foo-bar')

        // use a relative path for the fileUtilsname
    expect(fileUtils.lookupRequirePath('./foo-bar')).to.deep.equal(path.resolve('foo-bar'))
    expect(fileUtils.lookupRequirePath('./dir/foo-bar')).to.deep.equal(path.resolve('dir', 'foo-bar'))
    expect(fileUtils.lookupRequirePath('./foo-bar', 'pre')).to.deep.equal(path.resolve('pre', 'foo-bar'))
    expect(fileUtils.lookupRequirePath('./dir/foo-bar', 'pre')).to.deep.equal(path.resolve('pre', 'dir', 'foo-bar'))
  })

  it('check cases with an absolute prefix', () => {
        // node style path (no dot at the start and not absolute path)
    expect(fileUtils.lookupRequirePath('foo-bar', '/pre')).to.deep.equal(path.resolve('/pre', 'foo-bar'))
    expect(fileUtils.lookupRequirePath('dir/foo-bar', '/pre')).to.deep.equal(path.resolve('/pre', 'dir', 'foo-bar'))

        // use an absolute path for the fileUtilsname
    expect(fileUtils.lookupRequirePath('/usr/foo-bar', '/pre')).to.deep.equal('/usr/foo-bar')
    expect(fileUtils.lookupRequirePath('/usr/dir/foo-bar', '/pre')).to.deep.equal('/usr/dir/foo-bar')

        // use a relative path for the fileUtilsname
    expect(fileUtils.lookupRequirePath('./foo-bar', '/pre')).to.deep.equal(path.resolve('/pre', 'foo-bar'))
    expect(fileUtils.lookupRequirePath('./dir/foo-bar', '/pre')).to.deep.equal(path.resolve('/pre', 'dir', 'foo-bar'))
  })
})

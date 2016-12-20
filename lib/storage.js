var path = require('path')
var fs = require('fs')
var Archiver = require('hypercore-archiver')
var hypercore = require('hypercore')
var hyperdrive = require('hyperdrive')
var storage = require('random-access-file')
var rimraf = require('rimraf')
var mkdirp = require('mkdirp')
var pump = require('pump')

module.exports = Storage

function Storage (dir, opts) {
  if (!(this instanceof Storage)) return new Storage(dir, opts)
  var self = this

  mkdirp.sync(dir)

  self.path = dir
  self.archiver = Archiver(dir)

  return self
}

Storage.prototype.createBackup = function (source, data, cb) {
  var self = this

  self.drive = self.drive || hyperdrive(self.archiver.db)
  self._coreCopy = self._coreCopy || hypercore(self.archiver.db)

  var tmp = path.join(self.path, '.tmp')
  mkdirp.sync(tmp)

  var dest = self.drive.createArchive({
    // all {live: false} needed or archives do not end up as snapshots
    live: false,
    content: self._coreCopy.createFeed({
      live: false,
      storage: storage(path.join(tmp, 'content'))
    }),
    metadata: self._coreCopy.createFeed({
      live: false,
      storage: storage(path.join(tmp, 'metadata'))
    })
  })

  source.list({live: false}, function (err, entries) {
    if (err) return cb(err)

    next()
    function next () {
      var entry = entries.shift()
      if (!entry) return finalize()
      if (entry.type !== 'file') return next()
      pump(source.createFileReadStream(entry),
            dest.createFileWriteStream({ name: entry.name, mtime: entry.mtime, ctime: entry.ctime }),
            next)
    }
  })

  function finalize () {
    dest.finalize(function () {
      var metaOld = path.join(tmp, 'metadata')
      var contOld = path.join(tmp, 'content')

      // move tmp dirs to hypercore-archiver storage folders w/ keys
      keyToDir(dest.metadata.key, self.path, function (err, metaNew) {
        if (err) return cb(err)
        fs.rename(metaOld, metaNew, function (err) {
          if (err) return cb(err)
          keyToDir(dest.content.key, self.path, function (err, contNew) {
            if (err) return cb(err)
            fs.rename(contOld, contNew, function (err) {
              if (err) return cb(err)
              done()
            })
          })
        })
      })
    })
  }

  function done () {
    self.archiver.add(dest.key, data, function () {
      rimraf(tmp, function (err) {
        if (err) return cb(err)
        cb(null, dest)
      })
    })
  }
}

Storage.prototype.deleteBackup = function (key, cb) {
  var self = this
  self.archiver.get(key, function (err, feed, content) {
    if (err) return cb(err)
    self.archiver.remove(key, function (err) {
      if (err) return cb(err)
      deleteDirs()
    })

    function deleteDirs () {
      var metaDir = path.join(self.path, 'data', feed.key.toString('hex').slice(0, 2))
      var contDir = path.join(self.path, 'data', content.key.toString('hex').slice(0, 2))
      rimraf(metaDir, function (err) {
        if (err) return cb(err)
        rimraf(contDir, cb)
      })
    }
  })
}

function keyToDir (key, dir, cb) {
  key = key.toString('hex')
  var rootDir = path.join(dir, 'data', key.slice(0, 2))
  var childDir = path.join(rootDir, key.slice(2) + '.data')

  mkdirp(rootDir, function (err) {
    if (err) return cb(err)
    cb(null, childDir)
  })
}

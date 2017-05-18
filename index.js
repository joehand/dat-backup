var assert = require('assert')
var path = require('path')
var homedir = require('os-homedir')
var thunky = require('thunky')
var through = require('through2')
var Dat = require('dat-node')

module.exports = datBackup

function datBackup (source, opts) {
  assert.ok(source, 'history: source required')
  opts = opts || {}

  var archive = source.archive || source // hyperdrive + dat-node support
  var dir = opts.dir
  if (!dir) {
    var rootDir = path.join(homedir(), '.dat', 'backup')
    var discKey = archive.discoveryKey.toString('hex')
    dir = path.join(rootDir, discKey.slice(0, 2), discKey.slice(2))
  }

  var backup = {
    dir: dir,
    source: archive
  }
  backup.add = add
  backup.remove = remove
  backup.list = list
  backup.serve = serve
  backup.create = thunky(_create)

  return backup

  function _create (cb) {
    // TODO: use sparse but only replicate local latest (not remote)?
    Dat(dir, {key: archive.key, latest: false}, function (err, dat) {
      if (err) return cb(err)
      backup.dat = dat
      cb()
    })
  }

  function add (opts, cb) {
    if (!backup.dat) return backup.create(function (err) {
      if (err) return cb(err)
      add(opts, cb)
    })
    // TODO: add tagability
    if (typeof opts === 'function') cb = opts
    var stream = backup.dat.archive.replicate({live: opts.live})
    stream.on('end', cb)
    stream.on('error', cb)
    stream.pipe(archive.replicate()).pipe(stream)
  }

  function remove (cb) {
    // TODO!
    cb(new Error('not implemented'))
  }

  function list () {
    if (!backup.dat) return backup.create(list)
    var filter = through.obj(function (chunk, enc, cb) {
      if (!chunk.value) return cb(null, null)
      // TODO: don't print any dirs
      if (chunk.name === '/') return cb(null, null)

      var blocks = {start: chunk.value.offset, end: chunk.value.offset + chunk.value.blocks}
      var missing = false
      for (var i = blocks.start; i < blocks.end; i++) {
        if (!backup.dat.archive.content.has(i)) missing = true
      }
      if (missing) return cb(null, null)
      cb(null, chunk)
    })
    var stream = backup.dat.archive.history() // TODO: use dat.archive (backup) or source?
    return stream.pipe(filter)
  }

  function serve () {
    if (!backup.dat) return backup.create(serve)
    // only want to replicate from local, otherwise may download old versions + pollute local storage
    backup.dat.joinNetwork({download: false})
  }
}

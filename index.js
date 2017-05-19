var assert = require('assert')
var path = require('path')
var homedir = require('os-homedir')
var thunky = require('thunky')
var through = require('through2')
var each = require('stream-each')
var collect = require('stream-collector')
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
  backup.ready = thunky(_create)
  backup.ready()

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
    if (!backup.dat) {
      return backup.ready(function (err) {
        if (err) return cb(err)
        add(opts, cb)
      })
    }
    if (typeof opts === 'function') cb = opts

    var stream = backup.dat.archive.replicate({live: opts.live})
    stream.on('end', cb)
    stream.on('error', cb)
    stream.pipe(archive.replicate()).pipe(stream)
  }

  function remove (start, end, cb) {
    if (!backup.dat) {
      return backup.ready(function (err) {
        if (err) return cb(err)
        remove(opts, cb)
      })
    }
    if (typeof end === 'function') {
      cb = end
      end = null
    }

    var content = backup.dat.archive.content
    if (typeof start === 'object') {
      if (start.version === null) return cb(new Error('dat-backup: use {version: Number} to remove a version from backup.'))
      return clearVersions()
    }
    // Otherwise clear block nums
    content.clear(start, end, cb)

    function clearVersions () {
      // clear start.version -> end.version
      var endVer = end.version || start.version + 1
      var first = archive.tree.checkout(start.version, {cached: true})
      var second = archive.tree.checkout(endVer, {cached: true})
      var stream = first.diff(second, {dels: false, puts: true})

      each(stream, ondata, cb)

      function ondata (data, next) {
        var st = data.value
        content.cancel(st.offset, st.offset + st.blocks)
        // TODO: why is byteOffset passed here https://github.com/mafintosh/hyperdrive/blob/master/index.js#L253
        content.clear(st.offset, st.offset + st.blocks, {byteOffset: st.byteOffset, byteLength: st.size}, next)
      }
    }
  }

  function list (opts, cb) {
    if (!backup.dat) throw new Error('Run backup.ready first')
    if (typeof opts === 'function') {
      cb = opts
      opts = null
    }
    opts = Object.assign({}, opts)

    opts.cached = true
    var stream = backup.dat.archive.history(opts) // TODO: use dat.archive (backup) or source?
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

    return collect(stream.pipe(filter), cb)
  }

  function serve () {
    if (!backup.dat) return backup.ready(serve)
    // only want to replicate from local, otherwise may download old versions + pollute local storage
    backup.dat.joinNetwork({download: false})
  }
}

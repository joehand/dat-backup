var archiverServer = require('archiver-server')
var Storage = require('./lib/storage')

module.exports = datBackup

function datBackup (dir, opts) {
  if (!dir) throw new Error('Directory of archive required.')
  opts = opts || {}

  var backup = {}
  var storage = Storage(dir)

  backup.storage = storage
  backup.add = add
  backup.remove = remove
  backup.list = list
  backup.serve = serve

  return backup

  function add (archive, data, opts, cb) {
    if (typeof opts === 'function') return add(archive, data, {}, opts)
    if (archive.live === false) return cb(new Error('Archive must be live to backup.'))
    storage.archiver.changes() // TODO: hypercore-archiver bug? doesn't open feed otherwise

    storage.createBackup(archive, data, function (err, dest) {
      if (err) return cb(err)
      cb(null, dest)
    })
  }

  function remove (key, opts, cb) {
    if (typeof opts === 'function') return remove(key, {}, opts)
    if (!opts.delete) return storage.archiver.remove(key, cb)
    storage.deleteBackup(key, cb)
  }

  function list (cb) {
    storage.archiver.changes(function (err, feed) {
      if (err) return cb(err)
      if (feed.blocks === 0) return cb('No backups in directory.')
      cb(null, feed.createReadStream(), feed.key)
    })
  }

  function serve () {
    var server = archiverServer(storage.archiver, {http: false})
    return server.swarm
  }
}

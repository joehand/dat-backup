var test = require('tape')
var hyperdrive = require('hyperdrive')
var ram = require('random-access-memory')
var tempDir = require('temporary-directory')
var createBackup = require('..')

test('create backup, add file, and list', function (t) {
  tempDir(function (_, dir, cleanup) {
    var archive = hyperdrive(ram)
    archive.writeFile('hello.txt', 'hello world', function (err) {
      t.error(err, 'no error')

      var backup = createBackup(archive)
      backup.add(function (err) {
        t.error(err, 'no error')

        t.same(backup.dat.archive.version, archive.version, 'version up to date')
        var stream = backup.list()
        stream.on('data', function (data) {
          t.same(data.name, '/hello.txt')
          t.same(data.version, archive.version, 'file version okay')
          remove()
        })
        stream.on('error', function (err) {
          t.error(err, 'no error')
        })
      })

      function remove () {
        backup.remove({version: 0}, {version: archive.version}, function (err) {
          t.error(err, 'no error')

          var stream = backup.list()
          stream.on('data', function () {
            t.fail('should not have any data')
          })
          stream.on('end', function () {
            cleanup(function () {
              t.end()
            })
          })
          stream.on('error', function (err) {
            t.error(err, 'no error')
          })
        })
      }
    })
  })
})

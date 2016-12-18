#!/usr/bin/env node

var path = require('path')
var minimist = require('minimist')
var Dat = require('dat-node')
var each = require('stream-each')
var logger = require('status-logger')
var DatBackup = require('.')

try {
  var importUI = require('dat-next/lib/ui/import-progress')()
} catch (e) { }

var argv = minimist(process.argv.slice(2), {
  alias: {
    'dir': 'd',
    'list': 'l',
    'serve': 's',
    'create': 'c',
    'remove': 'r'
  },
  boolean: ['remove', 'save', 'serve', 'list'],
  default: {
    'dir': process.cwd(),
    'import': true
  }
})

var backup = DatBackup(path.join(argv.dir, '.dat-backup'))
var importer = null

var output = ['', '']
var log = logger(output, argv)
setInterval(function () {
  log.print()
  if (importer && importUI) importProgress()
}, 100)

if (argv.remove) {
  output[0] = 'Removing backup...'
  backup.remove(argv.key, argv, function (err) {
    if (err && err.message.indexOf('Key not found') > -1) return exit('No backup found with that key.')
    if (err) return exit(err)
    output[0] = 'Removed backup from database'
    if (argv.delete) output[1] = 'Deleted backup from hard drive'
    exit()
  })
} else if (argv.create) {
  if (!argv.name) exit('Please use --name option to save archive.')

  output[0] = 'Reading archive in ' + argv.dir
  readArchive(function (err, archive) {
    if (err) return exit(err)
    backup.add(archive, {name: argv.name}, argv, function (err, dest) {
      if (err) return exit(err)
      output[0] = 'Created backup archive:'
      output[1] = '  ' + argv.name + '\n  ' + dest.key.toString('hex')
      exit()
    })
  })
} else {
  if (argv.serve) {
    output[0] = 'Serving backups on the Dat Network\n'
    backup.serve()
  }
  if (argv.list) {
    backup.list(function (err, stream, key) {
      if (err) return exit(err)
      output[1] = 'Listing Backups...'
      output.push('')
      var cnt = 0
      var index = {}
      each(stream, function (tag, next) {
        if (!tag) return next()
        tag = JSON.parse(tag)
        if (tag.type === 'add') {
          output.push(tag.data.name)
          index[tag.key] = output.length - 1
          output.push('  ' + tag.key + '\n')
          cnt++
        } else {
          var oldLine = output[index[tag.key]]
          output[index[tag.key]] = 'REMOVED - ' + oldLine
          cnt--
        }
        next()
      }, function (err) {
        if (err) return exit(err)
        output[1] = 'Backups'
        output.push('\n-----------')
        if (cnt === 0) output.push('No backups')
        else {
          output.push('Backup Feed')
          output.push('  ' + cnt + ' Active Backup' + (cnt !== 1 ? 's' : ''))
          output.push('  Key: ' + key.toString('hex'))
        }
        output.push('-----------')
        if (!argv.serve) return exit()
      })
    })
  }

  if (!argv.list && !argv.serve) {
    require('./usage')()
  }
}

function readArchive (cb) {
  Dat(argv.dir, function (err, dat) {
    if (err) return cb(err)

    if (!dat.resumed) output[0] = 'No existing archive found. Creating new archive.'
    if (!dat.owner || !argv.import) return cb(null, dat.archive)

    output[0] = 'Importing updated files before backup'
    var startBlocks = dat.archive.blocks
    importer = dat.importFiles({resume: true, ignore: /[/\\]\.dat-backup/}, function (err) {
      if (err) return cb(err)
      var changeBlocks = dat.archive.blocks - startBlocks
      if (changeBlocks && startBlocks) output[1] = changeBlocks + ' Files changed or added in import'
      else output[1] = ''
      output[0] = 'Creating backup'
      importer = false // stop printing import
      cb(null, dat.archive)
    })
  })
}

function importProgress () {
  output[1] = importUI(importer)
}

function exit (err) {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  log.print()
  process.exit(0)
}

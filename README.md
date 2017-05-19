# dat-backup

Backup a dat to local storage. Useful for:

* Storing full history
* Creating local backups of data (good for offline backups!)
* More efficient storage (all content, latest and historic, is stored as a single `content.data` file)

## Usage

A dat backup is good for situations where an archive is only storing the `latest` content but you want to keep historic version of content around locally, either temporarily or permanently.

```js
var createBackup = require('dat-backup')

var archive = hyperdrive('/dir', {latest: true}) // some existing archive or dat-node instance

// default dir is ~/.dat/backups/<discovery-key>
var backup = createBackup(archive, {dir: '/big-hd/' + archive.discoveryKey.toString('hex')})

backup.ready(function (err) {
  if (err) throw err

  // backup archive at current version
  backup.add(function () {
  	console.log('archive backed up at version: ', archive.version)
  })

  // List all file versions available in archive backup
  backup.list(function (err, files) {
    if (err) throw err
    console.log(files)
  })
})
```

## API

### `var backup = createBackup(source, [opts])`

`source` is either a hyperdrive `archive` or dat-node instanace, `dat`.

Options are:

* `opts.dir`: where to store backups, defaults to `~/.dat/backup/discKey.slice(0, 2), discKey.slice(2)`

#### `backup.ready()`

Initalize the backup and make sure it is ready for adding, etc. This is often called automatically but for sync commands you may need to call it first, e.g. `backup.list()`.

#### `backup.add([opts], cb)`

Create a new backup of the archive at current version. Will backup *all content* available in the current archive, but not any remote archives. `callback` will be called when finished, unless live.

Options are:

* `opts.live`: Do a live backup, backing up content as it is updated. Will not callback.

#### `backup.remove(start, [end], cb)`

Remove archive version(s) from local backup.

Start and end have the following properties: `{version: 0}`. `end.version` defaults to `start.version + 1`.

You can also pass *content* block numbers directly (equivilant to `archive.content.clear(start, end, cb)`).

#### `var stream = backup.list([opts], [cb])`

List all data available in backup. Streams a list of files from `archive.history()` if they are backed up. `opts` are passed to `archive.history`.

If `cb` is provided, stream will collect the list and callback with `(err, list)`.

#### `backup.serve()`

Serve data from a backup. This will allow users to download any data that is backed up.

## License

MIT

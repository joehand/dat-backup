module.exports = function () {
  console.error('Usage: dat-backup [options]')
  console.error('')
  console.error('   --create --name="First Backup"      create archive backup')
  console.error('   --remove --key=<key> [--delete]     remove backup from db (delete files)')
  console.error('   --list, -l                          list backups')
  console.error('   --serve, -s                         serve backups over Dat network')
  console.error('')
  console.error('     --dir=<folder>                    set directory of Dat archive source')
  console.error('')
  console.error('  Use -ls to list all keys and share over network.')
  process.exit(1)
}

import {Command, flags} from '@oclif/command'

const execa = require('execa')

export default class LmIndex extends Command {
  static description = 'Print Netlify Large Media information'
  static examples = ['$ <%- config.bin %> lm']

  async run() {
    const gitVersion = execa('git', ['--version'])
    const lfsVersion = execa('git-lfs', ['--version'])
    const helperVersion = execa('git-credential-netlify', ['version'])

    try {
      gitVersion.stdout.pipe(process.stdout)
      await gitVersion
    } catch (error) {
      this.log(error.stderr)
    }
    this.log("\n\r")

    try {
      lfsVersion.stdout.pipe(process.stdout)
      await lfsVersion
    } catch (error) {
      this.log(error.stderr)
    }
    this.log("\n\r")

    try {
      helperVersion.stdout.pipe(process.stdout)
      await helperVersion
    } catch (error) {
      this.log(error.stderr)
    }
  } 
}
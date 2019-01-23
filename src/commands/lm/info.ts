import {Command, flags} from '@oclif/command'
import {GitValidators, checkHelperVersion} from '../../requirements'

const execa = require('execa')
const Listr = require('listr')
const semver = require('semver')

export default class LmInfo extends Command {
  static description = 'Netlify Large Media'
  static examples = ['$ <%- config.bin %> lm:info']

  static usage = 'lm:info'

  async run() {
    const steps = GitValidators
    steps.push({
      title: `Checking Netlify's Git Credentials version`,
      task: checkHelperVersion
    })

    const tasks = new Listr(steps, {concurrent: true, exitOnError: false})
    tasks.run().catch((err: any) => {})
  } 
}

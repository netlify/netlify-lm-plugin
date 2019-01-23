import {Command, flags} from '@oclif/command'
import Requirements from '../../requirements'

const execa = require('execa')
const Listr = require('listr')
const semver = require('semver')

export default class LmInfo extends Command {
  static description = 'Netlify Large Media'
  static examples = ['$ <%- config.bin %> lm:info']

  static usage = 'lm:info'

  async run() {
    const req = new Requirements()
    const steps = req.gitValidators()
    steps.push({
      title: `Checking Netlify's Git Credentials version`,
      task: req.checkHelperVersion
    })

    const tasks = new Listr(steps, {concurrent: true, exitOnError: false})
    tasks.run().catch((err: any) => {})
  } 
}

import {Command, flags} from '@oclif/command'
import Requirements from '../../requirements'

const execa = require('execa')
const Listr = require('listr')
const semver = require('semver')

export default class LmIndex extends Command {
  static description = 'Print Netlify Large Media information'
  static examples = ['$ <%- config.bin %> lm']

  async run() {
    const req = new Requirements()
    const steps = req.gitValidators()
    steps.push({
      title: `Checking Netlify's Git Credentials version`,
      task: this.checkHelperVersion
    })

    const tasks = new Listr(steps, {concurrent: true, exitOnError: false})
    tasks.run().catch(err => {})
  } 

  async checkHelperVersion() {
    try {
      const result = await execa('git-credential-netlify', ['--version'])
      return matchVersion(result.stdout, /git-credential-netlify\/([\.\d]+).*/, '0.1.1', `Invalid Netlify's Git Credential version. Please update to version 2.5.1 or above`)
    } catch (error) {
      return Promise.reject(new Error(`Check that Netlify's Git Credential helper is installed and updated to the latest version`))
    }
  }
}

function matchVersion(out, regex, version, message) {
  const match = out.match(regex)
  if (!match || match.length != 2 || semver.lt(match[1], version)) {
    return Promise.reject(new Error(message))
  }
}

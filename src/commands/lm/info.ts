import {Command, flags} from '@oclif/command'
import {
  GitValidators,
  checkLFSFilters,
  checkHelperVersion
} from '../../requirements'

const chalk = require('chalk')
const execa = require('execa')
const Listr = require('listr')
const semver = require('semver')

export default class LmInfo extends Command {
  static description = 'Netlify Large Media'
  static examples = ['$ <%- config.bin %> lm:info']

  static usage = 'lm:info'

  async run() {
    const steps = GitValidators
    steps.push(
      {
        title: 'Checking Git LFS filters',
        task: async () => {
          const installed = await checkLFSFilters()
          if (!installed) {
            throw new Error('Git LFS filters are not installed, run `git lfs install` to install them')
          }
        }
      },
      {
        title: `Checking Netlify's Git Credentials version`,
        task: async (ctx: any, task: any) => {
          const version = await checkHelperVersion()
          task.title += chalk.dim(` [${version}]`)
        }
      }
    )

    const tasks = new Listr(steps, {concurrent: true, exitOnError: false})
    tasks.run().catch((err: any) => {})
  } 
}

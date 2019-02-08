import {Command, flags} from '@oclif/command'
import {
  checkGitVersion,
  checkLFSVersion,
  checkLFSFilters,
  checkHelperVersion
} from '../../requirements'

const execa = require('execa')
const Listr = require('listr')
const semver = require('semver')

export default class LmInfo extends Command {
  static description = 'Netlify Large Media'
  static examples = ['$ <%- config.bin %> lm:info']

  static usage = 'lm:info'

  async run() {
    const steps = [
      {
        title: 'Checking Git version',
        task: checkGitVersion
      },
      {
        title: 'Checking Git LFS version',
        task: checkLFSVersion
      },
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
        task: checkHelperVersion
      }
    ]

    const tasks = new Listr(steps, {concurrent: true, exitOnError: false})
    tasks.run().catch((err: any) => {})
  } 
}

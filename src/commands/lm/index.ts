import {Command, flags} from '@oclif/command'

const execa = require('execa')
const Listr = require('listr')

export default class LmIndex extends Command {
  static description = 'Print Netlify Large Media information'
  static examples = ['$ <%- config.bin %> lm']

  async run() {
    const tasks = new Listr([
      {
        title: 'Checking Git version',
        task: () => checkVersion('git', 'Git is not installed')
      },
      {
        title: 'Checking Git LFS version',
        task: () => checkVersion('git-lfs', 'Git LFS is not installed')
      },
      {
        title: `Checking Netlify's Git Credentials version`,
        task: () => checkVersion('git-credential-netlify', `Netlify's Git Credentials helper is not installed`)
      },
    ], {concurrent: true})

    tasks.run().catch(err => {})
  } 
}

function checkVersion(program, error) {
  return execa.stdout(program, ['--version']).then(result => {
    if (result === '') {
      throw new Error(error)
    }
  })
}

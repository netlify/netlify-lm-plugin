import {Command, flags} from '@oclif/command'

export default class LmIndex extends Command {
  static description = 'Print Netlify Large Media configuration'
  static examples = ['$ <%- config.bin %> lm']

  async run() {
  }
}

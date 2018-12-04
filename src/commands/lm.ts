import {Command, flags} from '@oclif/command'

export default class NetlifyLargeMedia extends Command {
  static description = 'Netlify Large Media CLI'

  static examples = [
    'netlify lm:install',
    'netlify lm:setup'
  ]

  static flags = {
    help: flags.help({char: 'h'})
  }

  async run() {
  }
}

import {Command, flags} from '@oclif/command'
import {installPlatform} from '../../install'
import {printBanner} from '../../ui'

export default class LmInstall extends Command {
  static description = `Configures your computer to use Netlify Large Media.
It installs the required credentials helper for Git,
and configures your Git environment with the right credentials.
`
  static usage = 'lm:install'

  static examples = [
    '$ <%= config.bin %> lm:install'
  ]
  static aliases = ['lm:init']

  static flags = {
    force: flags.boolean({
      char: 'f',
      description: 'Force the credentials helper installation'
    })
  }

  async run() {
    const {flags} = this.parse(LmInstall)

    try {
      const installed = await installPlatform(flags.force)
      if (installed) {
        printBanner(this, flags.force)
      }
    } catch (error) {
      this.log(error)
    }
  }
}

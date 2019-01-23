import {Command} from '@oclif/command'
import {installPlatform} from '../../install'

export default class LmInstall extends Command {
  static description = `Configures your computer to use Netlify Large Media (LM).
It installs the required credentials helper for Git,
and configures your Git environment with the right credentials.
`
  static usage = 'lm:install'

  static examples = [
    '$ <%= config.bin %> lm:install'
  ]
  static aliases = ['lm:init']

  async run() {
    try {
      await installPlatform()
    } catch (error) {
      this.log(error)
    }
  }
}

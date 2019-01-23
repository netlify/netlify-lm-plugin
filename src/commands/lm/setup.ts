import {flags} from '@oclif/command'
import {installPlatform} from '../../install'
import {checkHelperVersion} from '../../requirements'

const Command = require('@netlify/cli-utils')
const { getAddons, createAddon } = require('netlify/src/addons')
const Listr = require('listr')

interface netlifyAddon {
  service_path: string;
}

export default class LmSetup extends Command {
  static description = `Configures your site to use Netlify Large Media.
It runs the install command if you have not installed the dependencies yet.
`

  static usage = 'lm:setup'
  static examples = [
    '$ <%= config.bin %> lm:setup'
  ]

  static flags = {
    'skip-install': flags.boolean({char: 's'})
  }

  async run() {
    const {flags} = this.parse(LmSetup)

    if (!flags['skip-install']) {
      try {
        await installHelperIfMissing()
      } catch (error) {
        this.log(error)
      }
    }

    const accessToken = await this.authenticate()
    const { api, site } = this.netlify

    const tasks = new Listr([
      {
        title: 'Provisioning Netlify Large Media',
        task: async function() {
          await provisionService(accessToken, site.id)
        }
      }
    ])
    tasks.run().catch((err: any) => this.log(err))
  }
}

async function installHelperIfMissing() {
  let installHelper = false
  try {
    await checkHelperVersion()
  } catch (error) {
    installHelper = true
  }

  if (installHelper) {
    return installPlatform()
  }
}

async function provisionService(accessToken: string, siteId: string) {
  if (!siteId) {
    return Promise.reject(new Error('No site id found, please run inside a site folder or `netlify link`'))
  }
  const addons = await getAddons(siteId, accessToken)

  if (typeof addons === 'object' && addons.error) {
    return Promise.reject(addons.error)
  }

  const currentAddon = addons.find((addon: netlifyAddon) => addon.service_path === '/.netlify/large-media')

  if (currentAddon.id) {
    return Promise.resolve('Service already provisioned for this site')
  }

  const settings = {
    siteId: siteId,
    addon: 'large-media'
  }
  return createAddon(settings, accessToken)
}

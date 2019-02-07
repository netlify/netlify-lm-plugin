import {flags} from '@oclif/command'
import {installPlatform} from '../../install'
import {checkHelperVersion} from '../../requirements'
import {printBanner} from '../../ui'

const Command = require('@netlify/cli-utils')
const { getAddons, createAddon } = require('netlify/src/addons')
const execa = require('execa')
const Listr = require('listr')

interface siteInfo {
  id_domain: string;
}

interface siteQuery {
  siteId: string;
}

interface netlifyAddon {
  service_path: string;
}

interface netlifyClient {
  getSite(req: siteQuery): siteInfo;
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
    'skip-install': flags.boolean({
      char: 's',
      description: 'Skip the credentials helper installation check'
    }),
    'force-install': flags.boolean({
      char: 'f',
      description: 'Force the credentials helper installation'
    })
  }

  async run() {
    const {flags} = this.parse(LmSetup)

    let helperInstalled = false
    if (!flags['skip-install']) {
      try {
        helperInstalled = await installHelperIfMissing(flags['force-install'])
      } catch (error) {
        this.log(error)
        return
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
      },
      {
        title: 'Configuring Git LFS for this site',
        task: async function() {
          await configureLFSURL(site.id, api)
        }
      }
    ])
    tasks.run().catch((err: any) => this.log(err))

    if (helperInstalled) {
      printBanner(this, flags['force-install'])
    }
  }
}

async function installHelperIfMissing(force: boolean) {
  let installHelper = false
  try {
    const version = await checkHelperVersion()
    if (!version) {
      installHelper = true
    }
  } catch (error) {
    installHelper = true
  }

  if (installHelper) {
    return installPlatform(force)
  }

  return false
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

  if (currentAddon) {
    return Promise.resolve('Service already provisioned for this site')
  }

  const settings = {
    siteId: siteId,
    addon: 'large-media'
  }
  return createAddon(settings, accessToken)
}

async function configureLFSURL(siteId: string, api: netlifyClient) {
  const siteInfo = await api.getSite({ siteId })
  const url = `https://${siteInfo.id_domain}/.netlify/large-media`

  return execa('git', ['config', '-f', '.lfsconfig', 'lfs.url', url])
}

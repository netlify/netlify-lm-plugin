import {Command, flags} from '@oclif/command'
import fs = require('fs')
import os = require('os')
import path = require('path')

import Requirements from '../../requirements'

const execa = require('execa')
const fetch = require('node-fetch')
const Listr = require('listr')

export default class LmSetup extends Command {
  static description = `Configures your computer to use Netlify Large Media (LM).
It installs the required credentials helper for Git,
and configures your Git environment with the right credentials.
`
  static usage = 'lm:setup'

  static examples = [
    '$ <%= config.bin %> lm:setup'
  ]
  static aliases = ['lm:init', 'lm:install']

  async run() {
    const platform = os.platform()

    switch (platform) {
      case 'linux':
        await this.setupLinux()
        break
      case 'darwin':
        await this.setupMacOS()
        break
      case 'win32':
        await this.setupWindows()
        break
      default:
        this.log(`Platform not supported: ${platform}`)
        this.log(`See manual setup instructions in https://github.com/netlify/netlify-credential-helper#install`)
    }
  }

  async setupLinux() {
    this.setupUnix('linux', 'Linux')
  }

  async setupMacOS() {
    this.setupUnix('darwin', 'Mac OS X')
  }

  async setupWindows() {
    const helperPath = path.join(os.homedir(), ".netlify", "helper")
    const req = new Requirements()
    const steps = req.gitValidators()

    steps.push(
      {
        title: `Installing Netlify's Git Credential Helper for Windows`,
        task: async function() {
          return installWithPowershell(helperPath)
        }
      },
      {
        title: `Configuring Git to use Netlify's Git Credential Helper`,
        task: () => setupGitConfig(helperPath)
      }
    )

    const tasks = new Listr(steps)
    tasks.run().catch(err => this.log(err))
  }

  async setupUnix(platformKey: string, platformName: string) {
    const req = new Requirements()
    const steps = req.gitValidators()

    steps.push(
      {
        title: `Installing Netlify's Git Credential Helper for ${platformName}`,
        task: async function(ctx, task) {
          const release = await resolveRelease()
          const file = await downloadFile(platformKey, release, 'tar.gz')
          ctx.helperPath = await extractFile(file)
        }
      },
      {
        title: `Configuring Git to use Netlify's Git Credential Helper`,
        task: (ctx, task) => {
          setupUnixPath(ctx.helperPath)
          setupGitConfig(ctx.helperPath)
        }
      }
    )

    const tasks = new Listr(steps)
    tasks.run().catch(err => this.log(err))
  }
}

async function installWithPowershell(helperPath: string) {
  const script = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
iex (iwr https://github.com/netlify/netlify-credential-helper/raw/master/resources/install.ps1)`

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'netlify-'))
  const scriptPath = path.join(temp, 'install.ps1')

  fs.writeFileSync(scriptPath, script)

  return execa('powershell', ['-ExecutionPolicy', 'unrestricted', '-File', scriptPath, '-windowstyle', 'hidden'])
}

async function resolveRelease() : Promise<string> {
  const res = await fetch("https://api.github.com/repos/netlify/netlify-credential-helper/releases/latest")
  const json = await res.json()
  return json.tag_name
}

async function downloadFile(platform: string, release: string, format: string) : Promise<string> {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'netlify-'))
  const name = `git-credential-netlify-${platform}-amd64.${format}`
  const filePath = path.join(temp, name)

  const url = `https://github.com/netlify/netlify-credential-helper/releases/download/${release}/${name}`
  const res = await fetch(url)
  const dest = fs.createWriteStream(filePath)

  await new Promise((resolve, reject) => {
    res.body.pipe(dest)
    res.body.on("error", reject)
    dest.on("finish", resolve)
  })

  return filePath
}

async function extractFile(file: string) : Promise<string> {
  const homedir = os.homedir()
  const dir = path.join(homedir, ".netlify", "helper", "bin")

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  await execa('tar', ['-C', dir, '-xzf', file])
  return path.dirname(dir)
}

function setupUnixPath(helperPath: string) {
  let shell = process.env.SHELL.split(path.sep).pop()
  const pathScript = `${helperPath}/path.${shell}.inc`

  const initContent = `
# The next line updates PATH for Netlify's Git Credential Helper.
if [ -f '${pathScript}' ]; then source '${pathScript}'; fi
`

  switch (shell) {
    case 'bash':
      const bashPath = `script_link="$( command readlink "$BASH_SOURCE" )" || script_link="$BASH_SOURCE"
apparent_sdk_dir="\$\{script_link%/*}"
if [ "$apparent_sdk_dir" == "$script_link" ]; then
apparent_sdk_dir=.
fi
sdk_dir="$( command cd -P "$apparent_sdk_dir" > /dev/null && command pwd -P )"
bin_path="$sdk_dir/bin"
if [[ ":\$\{PATH}:" != *":\$\{bin_path}:"* ]]; then
export PATH=$bin_path:$PATH
fi`
      fs.writeFileSync(pathScript, bashPath)
      writeConfig('.bashrc', initContent)
      break
    case 'zsh':
      fs.writeFileSync(pathScript, 'export PATH=${0:A:h}/bin:$PATH')
      writeConfig('.zshrc', initContent)
      break
    default:
      error = `Unable to set credential helper in PATH. We don't how to set the path for ${shell} shell.
Set the helper path in your environment PATH: ${helperPath}/bin`
      throw new Error(error)
  }
}

function setupGitConfig(helperPath: string) {
  // Git expects the config path to always use / even on Windows
  const gitConfigPath = path.join(helperPath, 'git-config').replace(/\\/g, '/')
  const gitConfigContent = `
# This next lines include Netlify's Git Credential Helper configuration in your Git configuration.
[include]
  path = ${gitConfigPath}
`
  const helperConfig = `[credential]
  helper = netlify
  useHttpPath = true
`

  fs.writeFileSync(path.join(helperPath, 'git-config'), helperConfig)
  writeConfig('.gitconfig', gitConfigContent)
}

function writeConfig(name: string, initContent: string) {
  const configPath = path.join(os.homedir(), name)
  if (!fs.existsSync(configPath)) {
    return
  }

  const content = fs.readFileSync(configPath, 'utf8')
  if (content.includes(initContent)) {
    return
  }

  fs.appendFileSync(configPath, initContent)
}

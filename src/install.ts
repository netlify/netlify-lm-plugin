import fs = require('fs')
import os = require('os')
import path = require('path')

import {GitValidators} from './requirements'

const execa = require('execa')
const fetch = require('node-fetch')
const hasbin = require('hasbin')
const Listr = require('listr')

export async function installPlatform(force: boolean) {
  const platform = os.platform()
  const steps = GitValidators
  const skipInstall = !force && installedWithPackageManager()

  switch (platform) {
    case 'linux':
      steps.push(setupUnix('linux', 'Linux', skipInstall))
      break
    case 'darwin':
      steps.push(setupUnix('darwin', 'Mac OS X', skipInstall))
      break
    case 'win32':
      steps.push(setupWindows(skipInstall))
      break
    default:
      throw new Error(`Platform not supported: ${platform}.
e manual setup instructions in https://github.com/netlify/netlify-credential-helper#install`)
  }

  steps.push(
    {
      title: `Configuring Git to use Netlify's Git Credential Helper`,
      task: setupGitConfig
    }
  )

  const tasks = new Listr(steps)
  await tasks.run()

  return !skipInstall
}

function skipHelperInstall(skip: boolean) {
  if (skip) {
    return `Netlify's Git Credential Helper already installed with a package manager`
  }
}

function installedWithPackageManager() {
  const installed = hasbin.sync('git-credential-netlify')
  return installed && !fs.existsSync(joinBinPath())
}

function setupWindows(skipInstall: boolean) {
  return {
    title: `Installing Netlify's Git Credential Helper for Windows`,
    skip: () => skipHelperInstall(skipInstall),
    task: installWithPowershell
  }
}

function setupUnix(platformKey: string, platformName: string, skipInstall: boolean) {
  return {
    title: `Installing Netlify's Git Credential Helper for ${platformName}`,
    skip: () => skipHelperInstall(skipInstall),
    task: async function() : Promise<any> {
      const release = await resolveRelease()
      const file = await downloadFile(platformKey, release, 'tar.gz')
      const helperPath = joinHelperPath()

      await extractFile(file, helperPath)
      await setupUnixPath()
    }
  }
}

async function installWithPowershell() {
  const helperPath = joinHelperPath()
  const script = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
iex (iwr -UseBasicParsing -Uri https://github.com/netlify/netlify-credential-helper/raw/master/resources/install.ps1)`

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'netlify-'))
  const scriptPath = path.join(temp, 'install.ps1')

  fs.writeFileSync(scriptPath, script)

  return execa('powershell', ['-ExecutionPolicy', 'unrestricted', '-File', scriptPath, '-windowstyle', 'hidden'])
}

async function setupGitConfig() : Promise<any>{
  return configureGitConfig(joinHelperPath())
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

async function extractFile(file: string, helperPath: string) {
  const binPath = path.join(helperPath, "bin")

  if (!fs.existsSync(binPath)) {
    try {
      fs.mkdirSync(binPath, { recursive: true })
    } catch (error) {
      if (!error.code || error.code !== 'ENOENT') {
        throw error
      }

      // Try creating the directory structure without
      // the recursive option because some versions
      // of Node ignore this option even when set.
      // See: https://github.com/FredLackey/node/pull/1
      const basePath = path.dirname(helperPath)
      if (!fs.existsSync(basePath)) {
        fs.mkdirSync(basePath)
      }

      if (!fs.existsSync(helperPath)) {
        fs.mkdirSync(helperPath)
      }

      if (!fs.existsSync(binPath)) {
        fs.mkdirSync(binPath)
      }
    }
  }

  await execa('tar', ['-C', binPath, '-xzf', file])
}

async function setupUnixPath() {
  const shellInfo = shellVariables()

  const initContent = `
# The next line updates PATH for Netlify's Git Credential Helper.
if [ -f '${shellInfo.path}' ]; then source '${shellInfo.path}'; fi
`

  switch (shellInfo.shell) {
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
      fs.writeFileSync(shellInfo.path, bashPath)
      return writeConfig('.bashrc', initContent)
    case 'zsh':
      fs.writeFileSync(shellInfo.path, 'export PATH=${0:A:h}/bin:$PATH')
      return writeConfig('.zshrc', initContent)
    default:
      const error = `Unable to set credential helper in PATH. We don't how to set the path for ${shellInfo.shell} shell.
Set the helper path in your environment PATH: ${helperPath}/bin`
      throw new Error(error)
  }
}

async function writeConfig(name: string, initContent: string) {
  const configPath = path.join(os.homedir(), name)
  if (!fs.existsSync(configPath)) {
    return
  }

  const content = fs.readFileSync(configPath, 'utf8')
  if (content.includes(initContent)) {
    return
  }

  return fs.appendFile(configPath, initContent, () => {})
}

async function configureGitConfig(helperPath: string) {
  let currentCredentials = []

  try {
    const {stdout} = await execa('git', ['config', '--no-includes', '--get-regexp', '^credential'])
    currentCredentials = stdout.split("\\n")
  } catch (error) {
    // ignore error caused by not having any credential configured
    if (error.stdout !== '') {
      throw error
    }
  }

  let helperConfig = `
# The first line resets the list of helpers so we can check Netlify's first.
[credential]
  helper = ""

[credential]
  helper = netlify
`

  let section = 'credential'
  if (currentCredentials.length > 0) {
    currentCredentials.forEach((line: string) => {
      const parts = line.split(' ')

      if (parts.length === 2) {
        const keys = parts[0].split('.')
        const localSection = keys.slice(0, -1).join('.')
        if (section !== localSection) {
          helperConfig += keys.length > 2 ? `\n[credential "${keys[1]}"]\n` : '\n[credential]\n'
          section = localSection
        }

        helperConfig += `  ${keys.pop()} = ${parts[1]}\n`
      }
    })
  }

  fs.writeFileSync(path.join(helperPath, 'git-config'), helperConfig)

  // Git expects the config path to always use / even on Windows
  const gitConfigPath = path.join(helperPath, 'git-config').replace(/\\/g, '/')
  const gitConfigContent = `
# This next lines include Netlify's Git Credential Helper configuration in your Git configuration.
[include]
  path = ${gitConfigPath}
`
  return writeConfig('.gitconfig', gitConfigContent)
}

function joinHelperPath() {
  return path.join(os.homedir(), ".netlify", "helper")
}

export function joinBinPath() {
  return path.join(joinHelperPath(), 'bin')
}

export function shellVariables() {
  let shell = process.env.SHELL
  if (!shell) {
    throw new Error('Unable to detect SHELL type, make sure the variable is defined in your environment')
  }

  shell = shell.split(path.sep).pop()
  return {
    shell: shell,
    path: `${joinHelperPath()}/path.${shell}.inc`
  }
}

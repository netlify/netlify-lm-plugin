import fs = require('fs')
import os = require('os')
import path = require('path')

import {GitValidators} from './requirements'

const execa = require('execa')
const fetch = require('node-fetch')
const Listr = require('listr')

export async function installPlatform() {
    const platform = os.platform()

    switch (platform) {
      case 'linux':
        return setupUnix('linux', 'Linux')
      case 'darwin':
        return setupUnix('darwin', 'Mac OS X')
      case 'win32':
        return setupWindows()
      default:
        return Promise.reject(new Error(`Platform not supported: ${platform}.
See manual setup instructions in https://github.com/netlify/netlify-credential-helper#install`))
    }
}

async function setupWindows() {
  const steps = GitValidators

  steps.push(
    {
      title: `Installing Netlify's Git Credential Helper for Windows`,
      task: installWithPowershell
    },
    {
      title: `Configuring Git to use Netlify's Git Credential Helper`,
      task: setupGitConfig
    }
  )

  const tasks = new Listr(steps)
  return tasks.run()
}

async function setupUnix(platformKey: string, platformName: string) {
  const steps = GitValidators

  steps.push(
    {
      title: `Installing Netlify's Git Credential Helper for ${platformName}`,
      task: async function() : Promise<any> {
        const release = await resolveRelease()
        const file = await downloadFile(platformKey, release, 'tar.gz')
        await extractFile(file)
      }
    },
    {
      title: `Configuring Git to use Netlify's Git Credential Helper`,
      task: configureUnixInstall
    }
  )

  const tasks = new Listr(steps)
  return tasks.run()
}

async function configureUnixInstall() : Promise<any> {
  const helperPath = joinHelperPath()
  const pathPromise = setupUnixPath(helperPath)
  const configPromise = configureGitConfig(helperPath)

  await pathPromise
  await configPromise
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

async function extractFile(file: string) {
  const helperPath = joinHelperPath()
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

async function setupUnixPath(helperPath: string) {
  let shell = process.env.SHELL
  if (!shell) {
    return Promise.reject(new Error('Unable to detect SHELL type, make sure the variable is defined in your environment'))
  }

  shell = shell.split(path.sep).pop()
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
      return writeConfig('.bashrc', initContent)
    case 'zsh':
      fs.writeFileSync(pathScript, 'export PATH=${0:A:h}/bin:$PATH')
      return writeConfig('.zshrc', initContent)
    default:
      const error = `Unable to set credential helper in PATH. We don't how to set the path for ${shell} shell.
Set the helper path in your environment PATH: ${helperPath}/bin`
      return Promise.reject(new Error(error))
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
    const {stdout} = await execa('git', ['config', '--global', '--get-regexp', '^credential'])
    currentCredentials = stdout.split("\\n")
  } catch (error) {
    // ignore error caused by not having any credential configured
    if (error.stdout !== '') {
      throw error
    }
  }

  try {
    await execa('git', ['config', '--global', '--rename-section', 'credential', 'credential-backup'])
  } catch (error) {
    // ignore error caused by not having any credential configured
    if (!error.stderr || !error.stderr.includes("no such section")) {
      throw error
    }
  }

  // Git expects the config path to always use / even on Windows
  const gitConfigPath = path.join(helperPath, 'git-config').replace(/\\/g, '/')
  const gitConfigContent = `
# This next lines include Netlify's Git Credential Helper configuration in your Git configuration.
[include]
  path = ${gitConfigPath}
`

  let helperConfig = `
# The first line resets the list of helpers so we can check Netlify's first.
[credential]
  helper = ""

[credential]
  helper = netlify
  useHttpPath = true
`

  let section = 'credential'
  currentCredentials.forEach((line: string) => {
    const parts = line.split(' ')
    if (parts.length === 2) {
      const keys = parts[0].split('.')
      const localSection = keys.slice(0, -1).join('.')
      if (section !== localSection) {
        helperConfig += keys.length > 2 ? `\n[credential "${keys[1]}"]\n` : '\n[credential]\n'
        section = localSection
      }

      helperConfig += `  ${keys.pop()}=${parts[1]}\n`
    }
  })

  fs.writeFileSync(path.join(helperPath, 'git-config'), helperConfig)
  return writeConfig('.gitconfig', gitConfigContent)
}

function joinHelperPath() {
  return path.join(os.homedir(), ".netlify", "helper")
}

const execa = require('execa')
const semver = require('semver')

export const GitValidators = [
  {
    title: 'Checking Git version',
    task: checkGitVersion
  },
  {
    title: 'Checking Git LFS version',
    task: checkLFSVersion
  }
]

export async function checkGitVersion() : Promise<void> {
  try {
    await execa('git', ['--version'])
  } catch (error) {
    return Promise.reject(new Error('Check that Git is installed in your system'))
  }
}

export async function checkLFSVersion() : Promise<void> {
  try {
    const result = await execa('git-lfs', ['--version'])
    return matchVersion(result.stdout, /git-lfs\/([\.\d]+).*/, '2.5.1', 'Invalid Git LFS version. Please update to version 2.5.1 or above')
  } catch (error) {
    return Promise.reject(new Error('Check that Git LFS is installed in your system'))
  }
}

export async function checkHelperVersion() {
  try {
    const result = await execa('git-credential-netlify', ['--version'])
    return matchVersion(result.stdout, /git-credential-netlify\/([\.\d]+).*/, '0.1.1', `Invalid Netlify's Git Credential version. Please update to version 2.5.1 or above`)
  } catch (error) {
    return Promise.reject(new Error(`Check that Netlify's Git Credential helper is installed and updated to the latest version`))
  }
}

function matchVersion(out: string, regex: RegExp, version: string, message: string) {
  const match = out.match(regex)
  if (!match || match.length != 2 || semver.lt(match[1], version)) {
    return Promise.reject(new Error(message))
  }
  return Promise.resolve(match[1])
}

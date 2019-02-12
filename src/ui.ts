import os = require('os')
import path = require('path')
import {shellVariables, joinBinPath} from './install'

const boxen = require('boxen')
const chalk = require('chalk')

export function printBanner(command: any, force: boolean) {
  const print = force || !binInPath()
  const platform = os.platform()

  if (print && platform !== 'win32') {
    const shellInfo = shellVariables()
    const banner = chalk.bold(`Run this command to use Netlify Large Media in your current shell\n\nsource ${shellInfo.path}`)

    command.log(boxen(banner, {padding: 1, margin: 1, align: 'center', borderColor: '#00c7b7'}))
  }
}

function binInPath() {
  const envPath = (process.env.PATH || '')
  const binPath = joinBinPath()
  return envPath.replace(/["]+/g, '').split(path.delimiter).find((part: string) => part === binPath)
}

netlify-lm
==========

Netlify CLI plugin to work with Netlify Large Media.

[![License](https://img.shields.io/npm/l/netlify-lm.svg)](https://github.com/netlify/netlify-lm-plugin/blob/master/package.json)

* [Usage](#usage)
* [Commands](#commands)

## Usage

```sh-session
$ netlify plugins:install netlify-lm
$ netlify lm:install
```

## Commands

### lm:info

Prints system information about Git, Git LFS and Netlify's Git Credential Helper.

### lm:install

This commands downloads Netlify's Git Credential Helper and configures
your environment to use it when you push media files to Netlify's Large Media.

If you run this commands multiple times, it will update the binary files and the configuration.

### lm:setup

This command configures your Netlify site to use Large Media.
It checks if you already have the Netlify's Git Credential Helper and it installs it if you don't.

# License

[License](LICENSE)

netlify-lm
==========

Netlify CLI plugin to work with Netlify Large Media.

[![License](https://img.shields.io/npm/l/netlify-lm.svg)](https://github.com/netlify/netlify-lm-plugin/blob/master/package.json)

* [Usage](#usage)
* [Commands](#commands)

## Usage

```sh-session
$ netlify plugins:install netlify-lm
$ netlify lm:setup
```

## Commands

### lm:setup

This commands downloads Netlify's Git Credential Helper and configures
your environment to use it when you push media files to Netlify's Large Media.

If you run this commands multiple times, it will update the binary files and the configuration.

# License

[License](LICENSE)

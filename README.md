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

### lm:info

Prints system information about Git, Git LFS and Netlify's Git Credential Helper.

### lm:install

This commands downloads Netlify's Git Credential Helper and configures
your environment to use it when you push media files to Netlify's Large Media.

If you run this commands multiple times, it will update the binary files and the configuration.

### lm:setup

This command configures your Netlify site to use Large Media.
It checks if you already have the Netlify's Git Credential Helper and it installs it if you don't.

## Development

This project uses Yarn to manage dependencies, use `yarn install` to install its dependencies.
If you want to test a development version with the CLI you can link your code 
with Netlify's CLI by running this from the base of this repository:

```
netlify plugins:link .
```

After that, you can check that the plugin is installed with `netlify lm:info`.

# License

[License](LICENSE)

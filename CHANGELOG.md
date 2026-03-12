# [0.7.0](https://github.com/CamiloEspinoza/Zeru/compare/v0.6.0...v0.7.0) (2026-03-12)


### Features

* **linkedin:** add preferred language for image prompts ([9ce699a](https://github.com/CamiloEspinoza/Zeru/commit/9ce699ab60255a051c7feb94a4e847e66e79e3a0))

# [0.6.0](https://github.com/CamiloEspinoza/Zeru/compare/v0.5.0...v0.6.0) (2026-03-11)


### Bug Fixes

* resolve react-hooks/set-state-in-effect lint error in TokenMeter ([157b0a6](https://github.com/CamiloEspinoza/Zeru/commit/157b0a67f8cb7d46cba37fb58c9b89092cfa0d52))


### Features

* add AI token tracking, cost control, and visual meter ([59dd4a7](https://github.com/CamiloEspinoza/Zeru/commit/59dd4a73a13b73762999eec58563bf775b41b418))
* overhaul LinkedIn post creation flow with draft-first carousel UX ([523ffe0](https://github.com/CamiloEspinoza/Zeru/commit/523ffe07cf97143089cc94125e587c7b9b06f532))

# [0.5.0](https://github.com/CamiloEspinoza/Zeru/compare/v0.4.1...v0.5.0) (2026-03-11)


### Bug Fixes

* **accounting:** remove explicit any casts in accounting services ([f404602](https://github.com/CamiloEspinoza/Zeru/commit/f404602b6c39073e4f9cf09ea002e4f26676f10b))
* **ci:** ignore release commits in commitlint to prevent body-max-line-length failures ([49e9e3d](https://github.com/CamiloEspinoza/Zeru/commit/49e9e3d23ec23e7b0681afdaed16216f8350efa6))
* remove all @typescript-eslint/no-explicit-any warnings ([3697d50](https://github.com/CamiloEspinoza/Zeru/commit/3697d50f863203a5208dc1163bba46f673da3904))
* remove remaining @typescript-eslint/no-explicit-any warnings ([2e93cc9](https://github.com/CamiloEspinoza/Zeru/commit/2e93cc9ecea75b22012883d990af89b3e52b5fb4))


### Features

* **ai:** add GPT-5.4 model support with configurable reasoning effort ([a757571](https://github.com/CamiloEspinoza/Zeru/commit/a757571c44ffc086f8be3c3a9d07709bf16c7c06))
* **assistant:** mobile-responsive chat UI and image vision support ([a2d02dc](https://github.com/CamiloEspinoza/Zeru/commit/a2d02dc365808d1a5e542ea36cd7a029bc0732e6))

## [0.4.1](https://github.com/CamiloEspinoza/Zeru/compare/v0.4.0...v0.4.1) (2026-03-11)


### Bug Fixes

* www.zeruapp.com redirect and Traefik v3 wildcard syntax ([6387764](https://github.com/CamiloEspinoza/Zeru/commit/6387764a41da924d6256384db5fd4e1183244275))

# [0.4.0](https://github.com/CamiloEspinoza/Zeru/compare/v0.3.3...v0.4.0) (2026-03-10)


### Features

* add openai developer docs mcp server ([3d31927](https://github.com/CamiloEspinoza/Zeru/commit/3d31927a16cc2e8a565b384a951fccae17c50629))

## [0.3.3](https://github.com/CamiloEspinoza/Zeru/compare/v0.3.2...v0.3.3) (2026-03-10)


### Bug Fixes

* wrap useSearchParams in Suspense on oauth-linkedin-redirect page ([c61ab47](https://github.com/CamiloEspinoza/Zeru/commit/c61ab474fa0142c3835bf59a2cce5db29e9d0c55))

## [0.3.2](https://github.com/CamiloEspinoza/Zeru/compare/v0.3.1...v0.3.2) (2026-03-10)


### Bug Fixes

* correct msg.type check and always run build on main push ([5e40918](https://github.com/CamiloEspinoza/Zeru/commit/5e40918106d1fed9e94e00c4c34daaa37aa960ee))

## [0.3.1](https://github.com/CamiloEspinoza/Zeru/compare/v0.3.0...v0.3.1) (2026-03-10)


### Bug Fixes

* pass empty body to api.post calls for linkedin publish/cancel ([70e5740](https://github.com/CamiloEspinoza/Zeru/commit/70e5740d2673c62f7b0ce65015fd4d2ae7eed2ed))

# [0.3.0](https://github.com/CamiloEspinoza/Zeru/compare/v0.2.0...v0.3.0) (2026-03-10)


### Bug Fixes

* add ESLint 9 flat config for shared/api, fix all lint errors ([48361dd](https://github.com/CamiloEspinoza/Zeru/commit/48361ddc34ddb5854da0b61644e8b794aac74309))
* don't invalidate login code before organization selection ([5651645](https://github.com/CamiloEspinoza/Zeru/commit/56516459c08f098fe33c5b4a268338aacf928dcf))
* **linkedin:** escape parentheses in post commentary to prevent truncation ([2b5e230](https://github.com/CamiloEspinoza/Zeru/commit/2b5e230dd1c8cba84ddcee9fe3ec9c5f6126c22a))
* validate journal entries, add MCP operational tools, and manual entry UI ([8d009e2](https://github.com/CamiloEspinoza/Zeru/commit/8d009e2a270147e7f0bf0ded730ead1a843bb9be))


### Features

* **linkedin:** add [@mention](https://github.com/mention) support for people and organizations in posts ([19f8c7d](https://github.com/CamiloEspinoza/Zeru/commit/19f8c7d4b850cb00a24d38aa7d7c0b48954ad190))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- LinkedIn integration with AI agent for post creation and scheduling
- @mention support for people and organizations in LinkedIn posts
- Community Management API for resolving LinkedIn profiles
- Escape parentheses in post commentary to prevent truncation by LinkedIn API

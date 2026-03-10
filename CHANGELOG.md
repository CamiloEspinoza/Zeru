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

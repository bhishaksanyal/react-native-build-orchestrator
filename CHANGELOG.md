## [1.8.1](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.8.0...v1.8.1) (2026-07-30)

### 🐛 Bug Fixes

* disable yarn lifecycle scripts in CI to address S6505 security lint rule ([f1e66d6](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/f1e66d67f030910bf1afe5a66f81515be15336e1))

## [1.8.0](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.7.0...v1.8.0) (2026-07-29)

### ✨ Features

* improve doctor checks for missing Fastlane/Bundler prerequisites ([59a030f](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/59a030f3376fc8e5ac4dceb93e9bbeae9b79facd))

### 📚 Documentation

* add dedicated Fastlane troubleshooting guide ([33d4b8f](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/33d4b8f7c3a4fcbd37c59c3d1edb8cb170adbd18))
* add richer Fastlane lane option docs and examples ([08a3032](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/08a30327367d33292222efb71bf48bad454152a7))

## [1.7.0](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.6.0...v1.7.0) (2026-07-29)

### ✨ Features

* add rnbuild release --summary output mode ([e4da75e](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/e4da75e37fe6cf1fbb185c677046ad7a71be92a2))

## [1.6.0](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.5.0...v1.6.0) (2026-07-29)

### ✨ Features

* add JSON Schema for .rnbuildrc.yml configuration ([eb196a3](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/eb196a3641156ee8f673b0f6e2ea50e204fabc34))

### 🐛 Bug Fixes

* do not stop CI pipeline if coverage upload fails ([acb6258](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/acb6258fdf8c64f963d3afd82e82a8c4f25427e2))
* skip Codecov CLI GPG verification in CI ([25cb457](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/25cb45755b29caec4cf3cf01d15593a06eb25095))
* wrap $ref with allOf to preserve sibling descriptions in draft-07, forbid androidArtifact on iOS targets ([0ca5bd5](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/0ca5bd5271930af357cff253a7402a89c53ac6c6))

## [1.5.0](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.4.0...v1.5.0) (2026-05-23)

### ✨ Features

* achieve high code coverage and establish robust test suite ([0ca4259](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/0ca4259cee4da029badd7754ca41a2daf765a857))

### 🐛 Bug Fixes

* apply CodeRabbit auto-fixes ([da14fdb](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/da14fdbb21d5751dd621443a476f73469e186ff1))
* remove then property from execa mock objects to resolve SonarCloud S7739 ([848580c](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/848580c2794560a5a851ff0c1e46d560c60dceda))
* replace /tmp/ paths with /app/ to resolve SonarCloud security hotspot ([74e1296](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/74e12969824290ce7906e683d9573678f60201f5))
* update execa assertions to match 3-arg call signature from runCommandWithLogs ([dadbb3e](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/dadbb3ef3ea7d0c331f9f59bfbc55d286bacba52))

## [1.4.0](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.3.1...v1.4.0) (2026-05-11)

### ✨ Features

* implement CI mode with structured JSON output ([dd108cb](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/dd108cb1c87f890e59cf1dbd31d5433158ee1ca8))

### 🐛 Bug Fixes

* ignore generated files in eslint config ([5836fe7](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/5836fe71d5d7ecdcc389fa40c5a82340844bcf48))
* improve type safety and synchronize package.json versioning ([69dad61](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/69dad61d61e3c57773a381d97f5448be2986e552))

## [1.3.1](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.3.0...v1.3.1) (2026-05-09)

### 🐛 Bug Fixes

* CI issue ([65aead1](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/65aead143f06f893a8227808c2c537e52fdbc138))

## [1.3.0](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.2.1...v1.3.0) (2026-05-09)

### ✨ Features

* add GitHub Actions examples and unit tests ([0c5e9f3](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/0c5e9f3eedc260c67a0c60f17542e9ce3e9b9a9e))
* add GitHub Actions release examples and unit tests ([f86ba90](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/f86ba90d770da9d6388507d7938d59e77d87cac3))
* add GitHub Actions release examples and unit tests ([c266007](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/c266007b548ba63eeb119c21ab394a4c18f0ecc4))
* add GitHub Actions release examples and unit tests ([bd34e56](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/bd34e56d9b5cb59884fb3079eb2a4762ecdcc258))
* add GitHub Actions release examples and unit tests ([32b0f5d](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/32b0f5d0c3b4abd7169d45a29a3ef74e49df0b0b))
* add GitHub Actions release examples and unit tests ([abb36b7](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/abb36b77adaab857c1d82cc30011cc10b30bff73))

## [1.2.1](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.2.0...v1.2.1) (2026-05-09)

### 🐛 Bug Fixes

* lock mismatch ([64b7b65](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/64b7b65b0c77ed1845f9a8a5d59b97b9356181f1))

## [1.2.0](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.1.0...v1.2.0) (2026-05-09)

### ✨ Features

* enable dual-publishing to npmjs.org and GitHub Packages ([b7b59b5](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/b7b59b59a09b3defa9d8dd4f66922662bcfe6346))

## [1.1.0](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.0.7...v1.1.0) (2026-05-08)

### ✨ Features

* setup GitHub Packages and update CLI description ([bbbe693](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/bbbe693b8ea7ebdeb4d4226ee9502193d325ea9c))

## [1.0.7](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.0.6...v1.0.7) (2026-05-08)

### 🐛 Bug Fixes

* adjust release permissions and asset directory ([27f8541](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/27f8541a71e9b3834dd20614c9b264fa3aeccd80))
* adjust release permissions and asset directory ([90cb08b](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/90cb08b8732e61e148e8f356e942b9fecbc6d3e9))

## [1.0.6](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.0.5...v1.0.6) (2026-05-08)

### 🐛 Bug Fixes

* update CLI description and release configuration ([5803ac9](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/5803ac95f0f83322a5c5699af36cb7a4f15edbf2))

### 📚 Documentation

* updated badges ([29696ae](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/29696ae5320d3c867ed2d79b991f022b9dd24aa3))
* updates badges ([fc8ccdb](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/fc8ccdb08b620566c8776f80afae94f519181421))

## [1.0.5](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.0.4...v1.0.5) (2026-04-26)

### 🐛 Bug Fixes

* trigger release ([053ef66](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/053ef669256da2d0b71e4209bffddae6d7ab667d))

## [1.0.4](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.0.3...v1.0.4) (2026-04-26)

### 🐛 Bug Fixes

* trigger release ([060c17b](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/060c17bc389efd992e449ce49af280413c62e02e))

## [1.0.3](https://github.com/bhishaksanyal/react-native-build-orchestrator/compare/v1.0.2...v1.0.3) (2026-04-26)

### ⚡ Performance

* Testing release automation ([0498f5d](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/0498f5d10893ce849225f5edebf0adeb6b970cc3))
* Testing release automation ([e085ed6](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/e085ed69bd50b80a1e30ec26b55644474ca3b7a7))

### 📚 Documentation

* Changelog added ([98509b8](https://github.com/bhishaksanyal/react-native-build-orchestrator/commit/98509b8d64e245b1c7b8a2509e79b81b324c2616))

# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2024

### 🐛 Bug Fixes
- Various stability improvements

## [1.0.1] - 2024

### ✨ Features
- Initial package features
- CLI commands for React Native build orchestration

## [1.0.0] - 2024

### ✨ Features
- Initial release of react-native-build-orchestrator
- Environment management (`init`, `env`, `doctor`)
- Flavor-aware Android/iOS builds (`build`, `run`)
- Version management (`version`)
- Fastlane integration (`fastlane`, `release`)
- Typed runtime env exports

---

**Note:** Starting from the next release, changes will be automatically documented through semantic-release based on conventional commit messages.

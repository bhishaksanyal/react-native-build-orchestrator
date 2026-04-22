# Contributing

Thanks for contributing to react-native-build-orchestrator.

## Development Setup

1. Install dependencies:

```bash
yarn install
```

2. Run checks:

```bash
yarn test
yarn build
```

## Coding Guidelines

- Keep changes focused and minimal.
- Preserve existing CLI behavior unless the change explicitly updates it.
- Add or update docs when command behavior changes.
- Prefer clear error messages for user-facing failures.

## Pull Requests

- Include a concise summary of what changed and why.
- Mention any breaking changes clearly.
- Ensure `yarn test` and `yarn build` pass.

## Reporting Bugs

Please open an issue with:

- command used
- expected behavior
- actual behavior
- relevant logs and environment details

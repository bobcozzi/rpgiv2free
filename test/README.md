# Test Fixtures

This directory contains the repository's fixture-based conversion tests and sample RPG IV source members.

## Layout

- [test/conversion.test.js](conversion.test.js) is the Vitest suite that discovers fixture pairs automatically.
- [test/load-converter.js](load-converter.js) provides the conversion helper used by the fixtures.
- [test/fixtures](fixtures) contains paired `*.fixed.rpgle` and `*.expected.rpgle` files.

## Running

Use `npm run validate` to compile the extension and run the full fixture suite.

Use `npm test` or `npm run test:fixtures` as aliases for the same validation step.

Use `npm run build` when you only want to compile TypeScript without running tests.

`npm run vscode:prepublish` now runs `npm run validate`, so packaging/publishing is gated by both compile success and passing tests.

Vitest discovers every `*.fixed.rpgle` file in `test/fixtures` and compares it to the matching `*.expected.rpgle` file automatically.
The comparison ignores leading and trailing spaces on each line, ignores a trailing semicolon on each line, and skips blank lines, so the fixtures can focus on the code itself.

## Adding a case

1. Add the fixed-format RPG IV source member text to `test/fixtures/<srcmbrname>.fixed.rpgle`.
2. Add the exact expected converted free-format output to `test/fixtures/<srcmbrname>.expected.rpgle`.
3. Run `npm run validate` to confirm the new fixture pair passes.

	Example: if you add a different RPG spec sample and it truly needs a different harness path, extend [test/load-converter.js](load-converter.js) or add a dedicated Vitest file in [test](.).

	If you are only adding another sample that matches the existing fixture flow, you do not need a new runner. Just add the `.fixed.rpgle` and `.expected.rpgle` pair and Vitest will pick it up automatically.

## Naming Convention

The `*.expected.rpgle` suffix is the conventional test name for the assertion-side file: the fixture is the input, and the expected file is the conversion result used for comparison.

If you prefer a more domain-specific suffix, `*.freeformat.rpgle` would also work, but it is a style choice rather than a test requirement. The current suite uses `*.expected.rpgle` because it is concise and common in paired test fixtures.
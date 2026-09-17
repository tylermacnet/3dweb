# Possible Enhancements

This document records evaluated improvements that are intentionally outside the current migration
scope. An enhancement should be adopted only when its ongoing maintenance cost is justified by a
clear improvement to product behavior, contributor workflow, or coverage.

## Selective Cucumber.js acceptance coverage

The project may add Cucumber.js (`@cucumber/cucumber`) as a development-only dependency for a
small set of business-facing acceptance scenarios. Candidate scenarios include:

- address normalization examples
- unique, ambiguous, and unknown location resolution
- listing filtering and sorting policies
- loading, empty, error, retry, and details flows

Cucumber should complement, not replace, the native `node:test` suites. Keep direct TypeScript
tests for precise domain branches, malformed input, stable sorting, cancellation, parser behavior,
and component or adapter contracts where direct stack traces and type-safe fixtures are more useful.

Before adoption, assess the added feature/step-definition configuration, TypeScript runtime setup,
test discovery, reporting, execution time, dependency maintenance, and duplicate-runner workflow.
If adopted, provide a dedicated `mise run test-bdd` task and include it in the appropriate
quality gate without making Cucumber a runtime or production-bundle dependency.

For the full command reference and architecture constraints, see `AGENTS.md`.

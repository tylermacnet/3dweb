---
name: Post-change review
description: The mandatory self-review before calling an architecture, behavior, or public-contract change complete - ownership and dependency direction, SOLID against current platform docs, test coverage, documentation sync, and the validation gate. Use before opening or updating a pull request.
---

# Post-change review

Complete every step before declaring the change done. A passing build does not replace the review,
and the change stays incomplete while any step is unaddressed.

1. **Ownership and dependency direction.** Does the code live in the feature that owns it? Domain
   rules stay free of Lit, DOM, `fetch`, and browser globals; adapters implement ports;
   components render and emit events. Move code to `shared/` only when it is genuinely reused,
   and keep the existing layer-first tree unless you are migrating a feature.
2. **SOLID and current platform practice.** Look the behaviour up in the official documentation
   for the pinned toolchain (mise, TypeScript, Lit, Valibot, GitHub Actions/Pages) instead of
   relying on memory, and record what you checked. Fix new coupling, duplicated business rules,
   unsafe browser behaviour, accessibility gaps, and type-safety holes.
3. **Test coverage.** Add focused tests for changed behaviour, new branches, edge cases,
   regressions, and integration contracts: domain rules in `test/unit/`, adapters, parser, DOM,
   network, and bundle in `test/integration/`.
4. **Documentation sync.** Update `docs/DEVELOPMENT.md`, `docs/STYLE_GUIDE.md`, `docs/ROADMAP.md`,
   `AGENTS.md`, and the skills under `.agents/skills/` when a contract, naming, workflow, or
   user-facing behaviour changes.
5. **Validation.** Run `mise run check` (lint, types, tests, build) and `mise run check:format`
   when the pre-commit hook is not installed. Report the actual result in the handoff.

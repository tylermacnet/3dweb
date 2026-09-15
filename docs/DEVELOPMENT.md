# Development workflow

## Use mise tasks first

Copilot and contributors **must strongly prefer repository-defined `mise` tasks** for all development workflows. Run tasks from the repository root with `mise run <task>`.

Use the task that matches the work:

| Task                                   | Purpose                                                  | Arguments                                      |
| -------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| `mise run build`                       | Create the production bundle                             | None                                           |
| `mise run watch`                       | Rebuild the bundle when source files change              | None                                           |
| `mise run serve`                       | Build and serve `public/` on port 8000                   | None                                           |
| `mise run dev`                         | Build, watch, and serve the site                         | None                                           |
| `mise run format [files...]`           | Format selected files or the repository                  | Optional paths; defaults to `.`                |
| `mise run format-check [files...]`     | Check formatting for selected files or the repository    | Optional paths; defaults to `.`                |
| `mise run lint [files...]`             | Lint selected files or the repository                    | Optional paths; defaults to `.`                |
| `mise run typecheck`                   | Type-check the project                                   | None                                           |
| `mise run test-unit [files...]`        | Run selected unit tests                                  | Optional paths; defaults to `test/unit`        |
| `mise run test-integration [files...]` | Run selected integration tests                           | Optional paths; defaults to `test/integration` |
| `mise run test`                        | Run all unit and integration tests                       | None                                           |
| `mise run check`                       | Run formatting, linting, type checking, tests, and build | None                                           |

Do not invoke `node`, `npm`, `npx`, or tool binaries directly when an equivalent `mise` task exists. Direct commands are permitted only when:

1. no suitable `mise` task exists; or
2. a `mise` task has failed and a direct command is needed to diagnose that failure.

If a direct diagnostic command is necessary, return to the corresponding `mise` task for final validation.

Formatting tasks default to the whole repository when no paths are provided. Prefer targeted paths during iterative development, for example:

```text
mise run format src/adapters/managebuilding-feed.ts test/integration
mise run format-check src/adapters/managebuilding-feed.ts test/integration
```

Every task exposes its supported arguments through `mise run <task> --help`. Tasks documented as
accepting no arguments intentionally keep their project configuration fixed; use a focused task
such as `format`, `lint`, or a test task when selecting files.

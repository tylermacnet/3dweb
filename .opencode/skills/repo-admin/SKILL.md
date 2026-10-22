---
name: Repo admin
description: One-time repository setup for this project: the GitHub ruleset that PR-gates main, the Pages source, the Copilot cloud-agent toolchain and MCP entry, and the agent client checklist. Use when setting up an agent client, restoring repository protection, or changing a repository setting - never for day-to-day development.
---

# Repo admin

Everything here runs once per repository setting or once per agent client. It is deliberately not
part of `docs/DEVELOPMENT.md`, because none of it belongs in a normal change.

## Protection on `main`

`main` is gated by the checked-in ruleset `.github/rulesets/main-pr-only.json` (id `25660072`):
PR required, required status check `check`, squash-only, no force-push, no deletion, no bypass.

```text
# first time
gh api -X POST repos/<owner>/<repo>/rulesets --input .github/rulesets/main-pr-only.json
# restore the existing ruleset after editing the file
gh api -X PUT repos/<owner>/<repo>/rulesets/25660072 --input .github/rulesets/main-pr-only.json
# inspect what is actually applied
gh api repos/<owner>/<repo>/rulesets/25660072
```

The required context is the job name `check` in `.github/workflows/ci.yml`. Renaming that job
without updating the ruleset leaves every PR unmergeable, because there is no bypass.

## Pages

Repository Settings → Pages → Source = GitHub Actions. `public/.nojekyll` is committed so Pages
serves maps and dotfiles; `pages.yml` deploys on every branch push, building production `dist/`
from `main` and branch previews from each ref.

## Copilot cloud agent

- Toolchain: `.github/workflows/copilot-setup-steps.yml` installs mise and the project
  dependencies; no separate setup is needed.
- No LSP client: type feedback comes from `mise run check:type` / `mise run check`.
- MCP is a repository setting (Settings → Copilot → MCP servers), never a file in the tree. Entry:

```json
{
  "mcpServers": { "mise": { "type": "local", "command": "mise", "args": ["mcp"], "tools": ["*"] } }
}
```

Verify the applied value:

```text
gh api repos/<owner>/<repo>/copilot/cloud-agent/configuration --jq .mcp_configuration
```

## Agent clients

- OpenCode reads the committed `opencode.jsonc`: LSP `mise run tool:lsp` for `.ts`/`.tsx`, and
  the `mise` MCP server for task and env introspection.
- Any other client wires the same two commands into its own user or global settings; the
  repository only ships the OpenCode config.
- Skill sources: project skills live in `.opencode/skills/` (committed). Tool-declared skills sync
  into `.agents/skills/` (gitignored, machine-local links) and re-sync with `mise run tool:skills`.

## Local git

```text
git config pull.rebase true
git config fetch.prune true
```

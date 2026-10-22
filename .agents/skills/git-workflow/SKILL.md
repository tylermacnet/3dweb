---
name: Git workflow
description: Run this repository's branch, pull request, merge, release, and branch-preview procedure. Use whenever you start or update a change, merge it, cut a v* release, or build a preview snapshot.
---

# Git workflow

`main` is PR-gated (ruleset in the `repo-admin` skill). Never commit, merge, force-push, or push
to `main`, and never create tags outside a release.

## Change

```text
git fetch origin
git switch -c <short-kebab-branch>
# ...commit...
mise run check && git push -u origin <branch>
gh pr create --fill
gh pr checks --watch
```

Agents may open and update PRs but never merge them: a maintainer who is not the author merges
(squash). Rebase onto `origin/main` before merging, never rebase `main`. The required check is the
`check` workflow; the ruleset also blocks force-push and deletion, and allows squash merges only.

After the merge:

```text
git switch main && git pull --ff-only && git branch -d <branch>
```

## Release

The changelog commit is a normal PR, because the ruleset applies to every change on `main`:
regenerate, merge the PR, then tag that merge commit.

```text
mise run release:changelog
mise run release:preview   # dry run, no files written
mise run release:check     # unmerged commits must be conventional
git tag v<major>.<minor>.<patch>
git push origin v<major>.<minor>.<patch>
```

`release.yml` builds the bundles and attaches them plus the generated notes to the tag. `cliff.toml`
is the changelog source of truth; `CHANGELOG.md` is committed.

## Branch previews

```text
mise run preview:build -- <ref>     # defaults to the current branch
```

Open `public/index.html?preview=<ref>`. CI rebuilds every active remote branch and prunes dead
ones, so the client snippet never changes; an unknown or expired ref falls back to production.

# API docs

Auto-generated HTML reference for the aztec-standards contracts, produced by
`nargo doc`.

## Generate

```bash
yarn docs
```

Requires `nargo` from the Aztec toolchain matching this repo's pinned version
(see `package.json` `config.aztecVersion`). Override the binary with `NARGO=/path/to/nargo`.

Output lands in `docs/api/latest/`. Open `docs/api/latest/index.html`.

The `docs/api/` directory is gitignored.

## Publish

```bash
yarn docs:publish
```

Regenerates the docs and pushes them to
[xorsal/aztec-standards-docs](https://github.com/xorsal/aztec-standards-docs)
where GitHub Pages serves them at
<https://xorsal.github.io/aztec-standards-docs/>.

Hosting lives on a personal repo because defi-wonderland disables Pages on
forks of its repositories. Override the destination with `DOCS_REPO` / `DOCS_BRANCH`.

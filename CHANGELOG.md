# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### <!-- 0 -->⛰️ Features

- *(dev)* Separate filters, per-view collapsed sections, singleton-driven ([a5d7f0c](https://github.com/tylermacnet/3dweb/commit/a5d7f0c27ef68e7a23da3f55bca5e5a8333999d1))
- *(dev)* Lazy collapsable sections via details ([2b06715](https://github.com/tylermacnet/3dweb/commit/2b067150069f65392bdc6cfa8ac7ce7d9ffeaecc))
- *(dev)* Show card/compact/list layouts via composable listing-grid ([bc58a4e](https://github.com/tylermacnet/3dweb/commit/bc58a4e899cdc0133ded87c95b2c45dc422865d4))
- Composable listing views with transparent lazy singleton ([35ad4d3](https://github.com/tylermacnet/3dweb/commit/35ad4d3d1382fba69e47a590d6748cbf3472a17e))
- Expose bundle config and split staging and dev hosts ([6b08105](https://github.com/tylermacnet/3dweb/commit/6b08105c40cce038fcba1c432efeacd8f8d1dd45))
- Complete phase 9 host page staging parity ([253c9a0](https://github.com/tylermacnet/3dweb/commit/253c9a08b1f153b67c6192c2067657df9a113c14))
- Compose phase 8 public surface with native popover details ([7712f44](https://github.com/tylermacnet/3dweb/commit/7712f4404f9e4c6a9f345bde96c79ca32f9f3035))
- Build presentation components with dialog, link, and style hardening ([cad714a](https://github.com/tylermacnet/3dweb/commit/cad714a0d9a05dafd8d40416bee90ec0853ffd1a))
- Wire locationGroups through ListingController to listing-filters ([c1f8be1](https://github.com/tylermacnet/3dweb/commit/c1f8be1d4bc9968a8cd39be6fe66e2007edc39d3))
- Cache locationGroups to prevent unnecessary re-renders, add integration tests ([957c971](https://github.com/tylermacnet/3dweb/commit/957c97150050f5f11d49598077a8ac1584f61c7d))
- *(phase-3)* Implement location-based filtering with cleanRegionName and grouped location options ([5d3879f](https://github.com/tylermacnet/3dweb/commit/5d3879fd136b7c5409df5cdc3fab0bf402b4fa8b))
- Wire listing filters and isolate production demo ([368cc1a](https://github.com/tylermacnet/3dweb/commit/368cc1a498d73067594819d1ab1212147b3b1373))
- Http feed ([6a74b7a](https://github.com/tylermacnet/3dweb/commit/6a74b7a25811ddbc538494912f9e5ed8fd183564))
- Parser ([6cc8056](https://github.com/tylermacnet/3dweb/commit/6cc8056d5b08b1c02ad289a479ca29251dacf644))
- Initial UI ([5d7d9c0](https://github.com/tylermacnet/3dweb/commit/5d7d9c039409bbce568dd30d5cd5add8db43094a))
- List filtering ([638698b](https://github.com/tylermacnet/3dweb/commit/638698b6ecd8a1c4f6c982877f78c9ec53b6a6fc))
- Address normalizer ([9669976](https://github.com/tylermacnet/3dweb/commit/9669976bae8eea332be5b6972c7b9a0085ab24c1))

### <!-- 1 -->🐛 Bug Fixes

- Reproduce and fix composable singleton bugs ([ae47f71](https://github.com/tylermacnet/3dweb/commit/ae47f71be1728825cb6b6a1003c8e5419b95ec58))
- *(dev)* Refresh via singleton store so all listing-grid views update ([d631f63](https://github.com/tylermacnet/3dweb/commit/d631f632a4e0c8a5c22672a0ec07b36a9b8a29a2))
- *(filters)* Align migrated listing filtering scope ([d88ea24](https://github.com/tylermacnet/3dweb/commit/d88ea241568ad15f45ba61c75bd0d9b96ed6f7ca))
- *(domain)* Handle ambiguous address locations ([7815408](https://github.com/tylermacnet/3dweb/commit/7815408c4fd1a3d6bfb8df221f17c95cedebde5c))

### <!-- 2 -->🚜 Refactor

- Rename details dialog to modal, harden feed adapters, complete phases 4-5 ([60ea3cc](https://github.com/tylermacnet/3dweb/commit/60ea3cc6c2862f44135807cd4850d82009b7ce9b))

### <!-- 3 -->📚 Documentation

- Capture composable listing views fix list ([8e2abcd](https://github.com/tylermacnet/3dweb/commit/8e2abcd8751711fd07dc51a3378b2ba7b647baee))
- Tighten mise MUST to never call tools directly ([f110fc4](https://github.com/tylermacnet/3dweb/commit/f110fc49df65361f99376ee185470abd81fe4234))
- Defer fragment deep-linking for listings to future enhancement ([2e60562](https://github.com/tylermacnet/3dweb/commit/2e605628c92f2f77566093a7f22715c6f299a5ae))
- Clarify no-root multi-component library model ([b21b2ea](https://github.com/tylermacnet/3dweb/commit/b21b2eacc445798b2e8a2700ab32c3278cdfbb74))
- Prefer aube as tool, mise as task manager ([aa09ed0](https://github.com/tylermacnet/3dweb/commit/aa09ed04305e73d24cb2ce0f659b47a7c17a97c1))
- Clarify runtime dependency policy ([1a8f52f](https://github.com/tylermacnet/3dweb/commit/1a8f52fb98229c07013c30a2154741d4c6edb9bd))
- Document conventional commit rules ([ccc2fef](https://github.com/tylermacnet/3dweb/commit/ccc2fef1711e25831504105495e6be826c146fed))

### <!-- 4 -->⚡ Performance

- Cut details popover open latency on our side of the timeline ([646b948](https://github.com/tylermacnet/3dweb/commit/646b948cb59772a0a270696d694fb846846539aa))

### <!-- 7 -->⚙️ Miscellaneous Tasks

- *(mise)* Add dual ESM build and port flags, add build:clean ([72f0923](https://github.com/tylermacnet/3dweb/commit/72f092330eb516e80b465398f686da14de58db03))
- Organize mise tasks into hierarchy ([a2169a9](https://github.com/tylermacnet/3dweb/commit/a2169a9137524038eb78e83ce4505ca45eaf587c))
- Add mise run skills task syncing tool agent skills ([dcdb457](https://github.com/tylermacnet/3dweb/commit/dcdb457c8352c164b8263365f128710f78893696))
- Pin mise toolchain, install deps with aube, add project lsp ([f3eb5af](https://github.com/tylermacnet/3dweb/commit/f3eb5af0c5efad3c27bdecd49a484b5cc809448f))
- Complete phase one domain validation ([558ade2](https://github.com/tylermacnet/3dweb/commit/558ade2c4d6d9c5da2ab67a6dee89e8ac78797db))
- Finalize migration review and demo ([72857d5](https://github.com/tylermacnet/3dweb/commit/72857d59a3d3e96b4f22579ca07c8169e3176097))
- *(agent)* Formating markdown ([c9a9eb6](https://github.com/tylermacnet/3dweb/commit/c9a9eb668727aad02d314ceab672ed47339dee03))
- *(agent)* Agentic Instructions ([411e592](https://github.com/tylermacnet/3dweb/commit/411e5920dcb91caceace4f22fdd320a824d4bbfd))

<!-- generated by git-cliff -->

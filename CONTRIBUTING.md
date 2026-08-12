# Contributing

Codex Sidebar Kit has one priority: keep the smallest native Codex operation path useful and easy to reproduce.

Before proposing a compatibility change:

1. Run `npm run check`.
2. Run `npm run codex` against the Codex version named in the issue.
3. Verify menu injection, embedded document loading, and native composer prefill.
4. Keep DOM selectors and private bridge details inside `runtime/` or `scripts/inject.mjs`.
5. Do not include OpenAI assets, modified application bundles, account data, or another project's source.

Pull requests should describe the exact user action, side effect, and visible result they repair. Avoid unrelated refactors in compatibility fixes.

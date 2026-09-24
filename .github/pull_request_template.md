## Summary

<!-- What does this PR change and why? One or two sentences. -->

Closes #<!-- issue number; use "Refs #" if the issue should stay open -->

## Type of change

- [ ] New test case
- [ ] Bug fix
- [ ] Framework / tooling enhancement
- [ ] CI
- [ ] Documentation

## Changes

<!-- Bullet list of the main changes. For tests, list the TC IDs added or changed. -->

-

## How was it tested?

<!-- Commands you ran and their result, for example `npx playwright test --grep @TC-012` (3 runs, all passed). -->

## Checklist

- [ ] Commits start with the issue ID, for example `#12 Add tasks API client`
- [ ] `npm run lint`, `npm run format:check` and `npm run typecheck` pass
- [ ] `npm test` passes locally; new tests pass on repeated runs (`--repeat-each=3`)
- [ ] New tests carry their `@TC-XXX` tag, and `@smoke` only when they are fast and stable
- [ ] Implemented test cases are marked with ✅ in `Test Cases for automation.md`
- [ ] Test data is created with `testData.create*` or `testData.track`, so it is cleaned up
- [ ] No API token, `.env` contents or unredacted traces in code, logs or this description
- [ ] README or `docs/` updated if behavior or usage changed

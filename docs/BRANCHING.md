# Git branches

| Branch | Use |
|--------|-----|
| `master` | Stable releases; merge from `develop` when cutting a release. |
| `develop` | Day-to-day integration; target PRs here by default. |
| `feature/*` | Short-lived work (e.g. catalog model, sarees shell); open PRs into `develop`. |

Push the branch you are on: `npm run git:push` (see `scripts/push-working.mjs`).

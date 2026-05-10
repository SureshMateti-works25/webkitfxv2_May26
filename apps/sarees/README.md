# SareeCart (`sarees-market`)

Configuration-first commerce shell (sarees first; groceries & LPG later).

## Principles

- **Forms** live in `src/config/forms/*.json` as `FormDefinition` documents for `@webkitfxv2/core-engine` + `JsonForm`.
- **Chrome & landing** copy live in `src/config/shell.json` — React only maps JSON to layout, no marketing copy in components.
- **Auth behaviour** (guest vs member session) is minimal glue in `src/auth/` — not a substitute for a real API.

## Commands

From repo root (after `npm install`):

```powershell
npm run build
npm run dev:sarees
```

## Structure

| Path | Role |
|------|------|
| `src/config/shell.json` | App name, nav, breadcrumbs, footer, landing sections, screen titles + `screens.login.enterprise` (login marketing column) |
| `src/config/forms/vendor-signup.json` | **Portal credentials** (`credentials.*` + confirm) first, then GST, address, `vendor.contacts[n].*` |
| `src/config/forms/shopper-signup.json` | Same **Portal credentials** block, then profile + delivery address |
| `src/config/forms/login.json` | Returning users: `credentials.loginName`, `credentials.password`, `session.rememberMe` only (no confirm here) |
| `src/config/shell.json` `screens.login.enterprise` | Left-column enterprise story (headline, intro, trends, metrics) for the `/login` split layout |
| `src/shell/*` | Header (logo, menu, mobile menu, settings, logout), breadcrumbs, footer |
| `src/pages/*` | Route bodies; signup/login render `JsonForm` only |

Extend **validation, layout types, or widgets** in `@webkitfxv2/core-engine` / `@webkitfxv2/react-renderer` when a capability is not expressible in JSON — avoid special-casing fields in this app.

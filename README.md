# webkitfxv2_May26

Working folder for the **JSON core engine** (`@webkitfxv2/core-engine`): layouts + templates, validation rules, conditions (`visibleWhen` / `enabledWhen`), path helpers.

## Prerequisites

- Node.js 18+

## Commands

```powershell
cd D:\workspace\personal\Reactjs\webkitfxv2_May26
npm install
npm run build
npm run test
```

`npm run check` runs build then tests.

## Package

| Path | NPM name |
|------|----------|
| `packages/core-engine` | `@webkitfxv2/core-engine` |

### Usage (after build)

```ts
import { createJsonEngine, type FormDefinition } from "@webkitfxv2/core-engine";

const form: FormDefinition = { /* ... */ };
const engine = createJsonEngine(form, { templates, context: { rules, conditions } });
const values = engine.initialValues();
const issues = await engine.validate(values);
```

Widget and domain-specific rule ids are resolved in your **app** registries only.

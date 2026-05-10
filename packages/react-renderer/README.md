# @webkitfxv2/react-renderer

Renders a `FormDefinition` from `@webkitfxv2/core-engine` using a **default widget registry** (`JsonForm`). Built-in controls read whitelisted keys from `field.props` (JSON-safe) and map them to native HTML attributes.

## Usage

```tsx
import { JsonForm } from "@webkitfxv2/react-renderer";
import type { FormDefinition } from "@webkitfxv2/core-engine";

const form: FormDefinition = { /* id, layout, fields */ };

export function Demo() {
  return (
    <JsonForm form={form} onSubmit={(values) => console.log(values)}>
      <button type="submit">Save</button>
    </JsonForm>
  );
}
```

Override or add widgets with `widgets={{ text: MyText }}`. Unknown `field.widget` values fall back to the `text` renderer.

## Theming

`JsonForm` always includes the classes `webkitfx-json-form webkitfx-theme`, which load a scoped token set (inputs, region cards, switch, submit button, errors).

- **Dark mode:** pass `className="webkitfx-theme--dark"` on `JsonForm` (can be toggled with React state).
- **Actions row:** wrap your submit area in `<div className="webkitfx-form-actions">` for spacing and a top divider. Plain `<button type="submit">` inside the form is still styled.

### Mobile-first layout

The theme is **mobile-first**: below 640px, multi-column **grids** collapse to a single column (overrides inline `grid-template-columns`), **horizontal stacks** stack vertically, submit actions are **full-width** with a 44px min tap height, and text controls use **16px** text to reduce iOS zoom-on-focus. Use `viewport-fit=cover` and safe-area padding in your host app shell (see `apps/demo`).

## Built-in `widget` ids

| `widget` | Control | Notable `field.props` |
|----------|---------|----------------------|
| `text` | `<input type="text">` | Whitelisted input attrs (see below) |
| `password` | password | same |
| `email` | email | same |
| `tel` | tel | same |
| `url` | url | same |
| `search` | search | same |
| `number` | number | `min`, `max`, `step`, … |
| `integer` | number (`step` default 1, integer parse) | same |
| `range` | range | same |
| `date` | date | same |
| `datetime-local` | datetime-local | same |
| `time` | time | same |
| `month` | month | same |
| `week` | week | same |
| `color` | color | same |
| `hidden` | hidden | same |
| `textarea` | textarea | `rows`, `cols`, `wrap`, … |
| `checkbox` | checkbox | value stored as boolean |
| `switch` | checkbox + `role="switch"` | optional `switchLabel` (string) |
| `select` | `<select>` | `options`, optional `placeholderOption` |
| `multiselect` | `<select multiple>` | `options`, `size` |
| `radio` | radio group | `options`, optional `radioName`, `inline` (boolean) |
| `file` | file | `accept`, `multiple`; values are **file name(s)** (string or string[]) |
| `json` | read-only `<pre>` | fallback for debugging |

### `options` shape (select / multiselect / radio)

```json
[
  { "value": "a", "label": "Option A" },
  "plain-string-value"
]
```

### Whitelisted passthrough (`field.props`)

- **Inputs** (`text`, `number`, …): `placeholder`, `readOnly`, `autoComplete`, `autoFocus`, `minLength`, `maxLength`, `min`, `max`, `step`, `multiple`, `accept`, `capture`, `list`, `inputMode`, `pattern`, `size`, `spellCheck`, `tabIndex`, `title`, `form`, `name`
- **Textarea**: `placeholder`, `readOnly`, `autoComplete`, `autoFocus`, `minLength`, `maxLength`, `rows`, `cols`, `wrap`, `spellCheck`, `tabIndex`, `title`, `form`, `name`
- **Select**: `readOnly`, `autoFocus`, `multiple`, `size`, `tabIndex`, `title`, `form`, `name`, `required`

All widgets also support top-level field styling via `field.props.className` and `field.props.style` (object).

### Engine flags

`field.props.disabled` (boolean) merges with `enabledWhen` from the engine (disabled if either applies).

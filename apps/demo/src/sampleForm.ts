import type { FormDefinition } from "@webkitfxv2/core-engine";

/** Sample form exercising default widgets, `props`, and `visibleWhen`. */
export const sampleForm: FormDefinition = {
  id: "demo-all-controls",
  title: "Default controls",
  layout: {
    type: "stack",
    axis: "vertical",
    gap: "1rem",
    children: [
      {
        type: "region",
        name: "Text inputs",
        children: [
          { type: "field", fieldId: "fullName" },
          { type: "field", fieldId: "bio" },
          { type: "field", fieldId: "website" }
        ]
      },
      {
        type: "grid",
        columns: "repeat(auto-fill, minmax(min(100%, 14rem), 1fr))",
        children: [
          { type: "field", fieldId: "age" },
          { type: "field", fieldId: "units" },
          { type: "field", fieldId: "volume" },
          { type: "field", fieldId: "meeting" },
          { type: "field", fieldId: "birthDate" },
          { type: "field", fieldId: "slotTime" },
          { type: "field", fieldId: "accent" }
        ]
      },
      {
        type: "region",
        name: "Choice controls",
        children: [
          { type: "field", fieldId: "active" },
          { type: "field", fieldId: "notifications" },
          { type: "field", fieldId: "role" },
          { type: "field", fieldId: "skills" },
          { type: "field", fieldId: "plan" }
        ]
      },
      {
        type: "region",
        name: "Conditional",
        children: [
          { type: "field", fieldId: "showExtra" },
          { type: "field", fieldId: "extraNote" }
        ]
      },
      {
        type: "region",
        name: "Other",
        children: [{ type: "field", fieldId: "avatar" }]
      }
    ]
  },
  fields: {
    fullName: {
      binding: "fullName",
      widget: "text",
      label: "Full name",
      description: "Plain text; try `minLength` from rules.",
      props: { placeholder: "Ada Lovelace", autoComplete: "name" },
      default: "",
      rules: [{ kind: "required" }, { kind: "minLength", value: 2 }]
    },
    bio: {
      binding: "bio",
      widget: "textarea",
      label: "Bio",
      props: { rows: 4, placeholder: "Short biography…" },
      default: ""
    },
    website: {
      binding: "website",
      widget: "url",
      label: "Website",
      props: { placeholder: "https://example.com" },
      default: ""
    },
    age: {
      binding: "age",
      widget: "integer",
      label: "Age",
      props: { min: 0, max: 130 },
      default: 30,
      rules: [{ kind: "minimum", value: 0 }, { kind: "maximum", value: 130 }]
    },
    units: {
      binding: "units",
      widget: "number",
      label: "Units (number)",
      props: { step: 0.5, min: 0 },
      default: 1
    },
    volume: {
      binding: "volume",
      widget: "range",
      label: "Volume",
      props: { min: 0, max: 100, step: 1 },
      default: 50
    },
    meeting: {
      binding: "meeting",
      widget: "datetime-local",
      label: "Meeting (local)",
      default: ""
    },
    birthDate: {
      binding: "birthDate",
      widget: "date",
      label: "Birth date",
      default: ""
    },
    slotTime: {
      binding: "slotTime",
      widget: "time",
      label: "Preferred time",
      default: ""
    },
    accent: {
      binding: "accent",
      widget: "color",
      label: "Accent color",
      default: "#2563eb"
    },
    active: {
      binding: "active",
      widget: "checkbox",
      label: "Account active",
      default: true
    },
    notifications: {
      binding: "notifications",
      widget: "switch",
      label: "Push notifications",
      description: "`switch` uses `switchLabel` in props for inline text.",
      props: { switchLabel: "Enabled" },
      default: false
    },
    role: {
      binding: "role",
      widget: "select",
      label: "Role",
      props: {
        placeholderOption: "Choose…",
        options: [
          { value: "viewer", label: "Viewer" },
          { value: "editor", label: "Editor" },
          { value: "admin", label: "Admin" }
        ]
      },
      default: "",
      rules: [{ kind: "required" }]
    },
    skills: {
      binding: "skills",
      widget: "multiselect",
      label: "Skills (multi)",
      props: {
        size: 5,
        options: ["TypeScript", "React", "Node", "CSS", "Design"]
      },
      default: []
    },
    plan: {
      binding: "plan",
      widget: "radio",
      label: "Billing plan",
      props: {
        inline: true,
        options: [
          { value: "free", label: "Free" },
          { value: "pro", label: "Pro" },
          { value: "team", label: "Team" }
        ]
      },
      default: "free"
    },
    showExtra: {
      binding: "showExtra",
      widget: "checkbox",
      label: "Show extra note field",
      default: false
    },
    extraNote: {
      binding: "extraNote",
      widget: "text",
      label: "Extra note",
      description: "Visible when “Show extra note” is checked.",
      visibleWhen: { op: "eq", path: "showExtra", value: true },
      props: { placeholder: "Only when visible…" },
      default: ""
    },
    avatar: {
      binding: "avatar",
      widget: "file",
      label: "Avatar (file names only)",
      props: { accept: "image/*" },
      default: ""
    }
  }
};

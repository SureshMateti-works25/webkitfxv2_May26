import type { ComponentType, ReactNode } from "react";
import type { FormDefinition } from "@webkitfxv2/core-engine";

/** Prose-only screen copy (DocStub / legal / settings). */
export type ShellCopyScreenCopy = {
  title: string;
  body: string;
  emptyHint?: string;
  continueShoppingLabel?: string;
  [key: string]: unknown;
};

/** JsonForm screen: header copy + form id reference resolved by the host app. */
export type JsonFormScreenCopy = {
  title?: string;
  lede?: string;
  cardTitle?: string;
  submitLabel?: string;
  ribbon?: string;
  [key: string]: unknown;
};

/** Catalog / PDP screen: section ids + copy map. */
export type CatalogScreenDefinition = {
  version?: string;
  copy: Record<string, string>;
  sections: string[];
};

export type RouteTemplateKind = "shellCopy" | "jsonForm" | "implementation";

export type RouteManifestEntry = {
  path: string;
  /** `implementation` = host registry component; default when `implementation` field is set. */
  template?: RouteTemplateKind;
  /** Shell `screens` key for shellCopy / jsonForm header copy. */
  screen?: string;
  /** Form bundle id (host resolves to FormDefinition). */
  form?: string;
  /** Host implementation registry key (e.g. home, checkout, productDetail). */
  implementation?: string;
};

export type RouteManifest = {
  version?: string;
  routes: RouteManifestEntry[];
};

export type ScreenCopyResolver = (screenKey: string) => ShellCopyScreenCopy | JsonFormScreenCopy;

export type FormResolver = (formId: string) => FormDefinition;

export type ImplementationRegistry = Record<string, ComponentType>;

export type JsonFormScreenProps = {
  copy: JsonFormScreenCopy;
  form: FormDefinition;
  className?: string;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  actions?: ReactNode;
  children?: ReactNode;
};

export type ShellCopyScreenProps = {
  copy: ShellCopyScreenCopy;
  className?: string;
};

export type ProseHeaderProps = {
  title: string;
  lede?: string;
  className?: string;
};

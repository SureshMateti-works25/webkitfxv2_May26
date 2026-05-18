import React from "react";
import { Route } from "react-router-dom";
import type { ReactElement } from "react";
import type {
  FormResolver,
  ImplementationRegistry,
  RouteManifest,
  ScreenCopyResolver,
} from "./types.js";
import { ShellCopyScreen } from "./ShellCopyScreen.js";
import { JsonFormScreen } from "./JsonFormScreen.js";
import type { ShellCopyScreenCopy, JsonFormScreenCopy } from "./types.js";

export type CreateRouteElementsOptions = {
  manifest: RouteManifest;
  implementations: ImplementationRegistry;
  resolveScreenCopy: ScreenCopyResolver;
  resolveForm: FormResolver;
  /** Host wires JsonForm submit + actions for template `jsonForm` routes. */
  createJsonFormRoute?: (entry: {
    path: string;
    screen: string;
    form: string;
  }) => ReactElement | null;
};

function shellCopyElement(
  screenKey: string,
  resolveScreenCopy: ScreenCopyResolver
): ReactElement {
  const copy = resolveScreenCopy(screenKey) as ShellCopyScreenCopy;
  return <ShellCopyScreen copy={copy} />;
}

/**
 * Builds `<Route path=… element=… />` list from `config/routes.json`.
 * Template routes use shared screens; catalog/checkout/etc. use `implementation` registry.
 */
export function createRouteElements(options: CreateRouteElementsOptions): ReactElement[] {
  const { manifest, implementations, resolveScreenCopy, resolveForm, createJsonFormRoute } =
    options;

  return manifest.routes.map((entry) => {
    const key = entry.implementation ?? entry.screen ?? entry.path;

    if (entry.implementation) {
      const Impl = implementations[entry.implementation];
      if (!Impl) {
        throw new Error(
          `Route ${entry.path}: missing implementation "${entry.implementation}"`
        );
      }
      return <Route key={entry.path} path={entry.path} element={<Impl />} />;
    }

    if (entry.template === "shellCopy" && entry.screen) {
      return (
        <Route
          key={entry.path}
          path={entry.path}
          element={shellCopyElement(entry.screen, resolveScreenCopy)}
        />
      );
    }

    if (entry.template === "jsonForm" && entry.screen && entry.form) {
      if (createJsonFormRoute) {
        const el = createJsonFormRoute({
          path: entry.path,
          screen: entry.screen,
          form: entry.form,
        });
        if (el) return <Route key={entry.path} path={entry.path} element={el} />;
      }
      const copy = resolveScreenCopy(entry.screen) as JsonFormScreenCopy;
      const form = resolveForm(entry.form);
      return (
        <Route
          key={entry.path}
          path={entry.path}
          element={
            <JsonFormScreen
              copy={copy}
              form={form}
              onSubmit={() => {
                /* host should use createJsonFormRoute for real handlers */
              }}
            />
          }
        />
      );
    }

    throw new Error(
      `Route ${entry.path}: set implementation or template+screen (key=${key})`
    );
  });
}

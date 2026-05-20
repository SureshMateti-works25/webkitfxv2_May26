import { getShell } from "./getShell.js";
import { screenDefinitions } from "./screens/index.js";

export type ScreenCopy = Record<string, unknown> & {
  title?: string;
  body?: string;
  lede?: string;
};

/** Merges `config/screens/*.json` copy with `shell.json` screens (JSON wins on keys). */
export function getScreenConfig(screenId: string): ScreenCopy {
  const shell = getShell();
  const shellScreen = (shell.screens as Record<string, ScreenCopy | undefined>)[screenId];
  const def = screenDefinitions[screenId];
  const fromFile = def?.copy ?? {};
  return { ...shellScreen, ...fromFile };
}

export function getCatalogScreen(screenId: string) {
  const def = screenDefinitions[screenId];
  if (!def || !("sections" in def)) {
    throw new Error(`Missing catalog screen definition: ${screenId}`);
  }
  return def;
}

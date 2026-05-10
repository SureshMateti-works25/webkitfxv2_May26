import type { ShellConfig } from "./shell.types.js";
import raw from "./shell.json";

export function getShell(): ShellConfig {
  return raw as ShellConfig;
}

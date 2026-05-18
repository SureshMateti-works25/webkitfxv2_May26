import type { ShellCopyScreenProps } from "./types.js";

/** Prose screen template — title + body from JSON/shell copy only. */
export function ShellCopyScreen({ copy, className = "screen-prose" }: ShellCopyScreenProps) {
  return (
    <div className={className}>
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
    </div>
  );
}


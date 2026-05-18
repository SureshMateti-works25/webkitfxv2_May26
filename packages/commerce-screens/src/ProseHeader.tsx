import type { ProseHeaderProps } from "./types.js";

export function ProseHeader({ title, lede, className = "screen-prose" }: ProseHeaderProps) {
  return (
    <header className={className}>
      <h1>{title}</h1>
      {lede ? <p>{lede}</p> : null}
    </header>
  );
}

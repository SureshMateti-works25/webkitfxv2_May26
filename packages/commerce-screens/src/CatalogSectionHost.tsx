import type { ReactNode } from "react";
import type { CatalogScreenDefinition } from "./types.js";

export type CatalogSectionRegistry = Record<string, (ctx: { enabled: boolean }) => ReactNode>;

export type CatalogSectionHostProps = {
  screen: CatalogScreenDefinition;
  sections: CatalogSectionRegistry;
  className?: string;
};

/**
 * Renders PDP (or similar) sections declared in `config/screens/*.json`.
 * Host registers section ids → React nodes; JSON only toggles order and copy keys.
 */
export function CatalogSectionHost({ screen, sections, className }: CatalogSectionHostProps) {
  return (
    <div className={className}>
      {screen.sections.map((id) => {
        const render = sections[id];
        if (!render) return null;
        return <section key={id} data-catalog-section={id}>{render({ enabled: true })}</section>;
      })}
    </div>
  );
}

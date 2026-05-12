import { getShell } from "../config/getShell.js";
import { FloatingCtaStack } from "./FloatingCtaStack.js";

/**
 * Fixed floating CTAs only. Offers/promotions render in-page via `ShellBodyWithPromo`.
 */
export function EdgeChrome() {
  const shell = getShell();
  const edge = shell.edgeChrome;
  if (!edge || edge.enabled === false) return null;
  if (!edge.floatingStack?.enabled || !edge.floatingStack.items?.length) return null;

  return (
    <div className="edge-chrome-root edge-chrome-root--float-only" data-edge-chrome="float">
      <FloatingCtaStack edge={edge} />
    </div>
  );
}

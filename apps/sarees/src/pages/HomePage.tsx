import { getShell } from "../config/getShell.js";
import { LandingSections } from "./LandingSections.js";

export function HomePage() {
  const shell = getShell();
  return (
    <div className="landing-page--fullbleed">
      <LandingSections sections={shell.landing.sections} />
    </div>
  );
}

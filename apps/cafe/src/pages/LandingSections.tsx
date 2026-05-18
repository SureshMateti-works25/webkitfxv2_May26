import { Link } from "react-router-dom";
import type { ShellLandingSection } from "../config/shell.types.js";

export function LandingSections({ sections }: { sections: ShellLandingSection[] }) {
  return (
    <div className="landing">
      {sections.map((section, i) => (
        <LandingSectionBlock key={i} index={i} section={section} />
      ))}
    </div>
  );
}

function LandingSectionBlock({ section, index }: { section: ShellLandingSection; index: number }) {
  if (section.type === "strap") {
    return (
      <div className="landing-strap" role="note">
        {section.message}
      </div>
    );
  }
  if (section.type === "hero") {
    const surface = section.surface ?? "cream";
    const heroClass =
      surface === "dark"
        ? "landing-hero landing-hero--immersive"
        : "landing-hero landing-hero--nistta-cream";
    return (
      <section className={heroClass} aria-labelledby={`hero-${index}`}>
        <div className="landing-hero__inner">
          {section.eyebrow ? <p className="landing-hero__eyebrow">{section.eyebrow}</p> : null}
          {section.kicker ? <p className="landing-hero__kicker">{section.kicker}</p> : null}
          <h1 className="landing-hero__title" id={`hero-${index}`}>
            {section.title}
          </h1>
          <p className="landing-hero__subtitle">{section.subtitle}</p>
          {section.trustLine ? <p className="landing-hero__trust">{section.trustLine}</p> : null}
          <div className="landing-actions">
            {section.actions.map((a) => (
              <Link key={a.path} to={a.path} data-variant={a.variant ?? "primary"}>
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }
  if (section.type === "highlights") {
    return (
      <section className="landing-highlights-wrap" aria-labelledby={`hl-${index}`}>
        <div className="landing-highlights-inner">
          <h2 className="landing-section-title" id={`hl-${index}`}>
            {section.title}
          </h2>
          <div className="landing-highlights">
            {section.items.map((it) => (
              <article key={it.title} className="landing-card">
                <h3>{it.title}</h3>
                <p>{it.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }
  return null;
}

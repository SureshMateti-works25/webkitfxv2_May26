import { JsonForm, type WidgetRenderer } from "@webkitfxv2/react-renderer";
import { readStringProp } from "@webkitfxv2/react-renderer";
import { useEffect, useMemo, useState } from "react";
import { chromeNoticeForm } from "../config/forms/index.js";

const MarqueeNoticeWidget: WidgetRenderer = (p) => {
  const message = typeof p.value === "string" ? p.value.trim() : "";
  const ariaLabel = readStringProp(p.field.props, "ariaLabel") ?? "Announcements";
  const repeatRaw = Number(p.field.props?.repeatCount ?? 2);
  const repeatCount = Number.isFinite(repeatRaw) ? Math.max(2, Math.floor(repeatRaw)) : 2;
  const repeated = useMemo(() => Array.from({ length: repeatCount }, () => message), [message, repeatCount]);
  if (!message) return null;

  return (
    <aside className="shell-notice-marquee__inner" aria-label={ariaLabel}>
      <div className="shell-notice-marquee__track">
        {repeated.map((m, i) => (
          <span key={`${m}-${i}`} aria-hidden={i > 0 ? "true" : undefined}>
            {m}
          </span>
        ))}
      </div>
    </aside>
  );
};

export function ChromeNoticeBar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`shell-notice-marquee${hidden ? " shell-notice-marquee--hidden" : ""}`}>
      <JsonForm
        form={chromeNoticeForm}
        className="shell-notice-marquee-form"
        widgets={{ marqueeNotice: MarqueeNoticeWidget }}
      />
    </div>
  );
}

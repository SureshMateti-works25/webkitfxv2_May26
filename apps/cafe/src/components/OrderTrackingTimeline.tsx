import type { TrackingTimelineStep } from "../lib/ordersApi.js";

export function OrderTrackingTimeline({ steps }: { steps: TrackingTimelineStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="order-track-timeline" aria-label="Order progress">
      {steps.map((step) => (
        <li
          key={step.id}
          className={[
            "order-track-timeline__step",
            step.done ? "order-track-timeline__step--done" : "",
            step.current ? "order-track-timeline__step--current" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="order-track-timeline__dot" aria-hidden="true" />
          <span className="order-track-timeline__label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

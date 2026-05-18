import {
  buildCafeWorkflowTimeline,
  getCafeOrderWorkflowsConfig,
  getCafeWorkflowChannel,
  getCafeWorkflowSteps,
} from "../lib/cafeOrderWorkflows.js";

type Props = {
  orderChannel: string | null | undefined;
  fulfillmentStatus: string;
  tableCode?: string | null;
};

export function KitchenWorkflowPanel({ orderChannel, fulfillmentStatus, tableCode }: Props) {
  const channelId = (orderChannel ?? "dine_in").trim() || "dine_in";
  const channel = getCafeWorkflowChannel(channelId);
  const timeline = buildCafeWorkflowTimeline(channelId, fulfillmentStatus);
  const config = getCafeOrderWorkflowsConfig();

  const table = (tableCode ?? "").trim();

  return (
    <section className="kitchen-workflow" aria-label="Order workflow">
      {table ? (
        <p className="kitchen-workflow__table" role="status">
          Serving <strong>Table {table}</strong>
        </p>
      ) : null}
      <h3 className="kitchen-workflow__title">{channel?.label ?? "Order workflow"}</h3>
      {channel?.description ? (
        <p className="kitchen-workflow__desc">{channel.description}</p>
      ) : null}
      <ol className="kitchen-workflow__steps">
        {timeline.map((step) => (
          <li
            key={step.id}
            className={[
              "kitchen-workflow__step",
              step.current ? "kitchen-workflow__step--current" : "",
              step.done ? "kitchen-workflow__step--done" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="kitchen-workflow__step-label">{step.label}</span>
            <span className="kitchen-workflow__step-code">{step.id}</span>
          </li>
        ))}
      </ol>
      <details className="kitchen-workflow__all-channels">
        <summary>All workflow definitions ({config.channels.length} channels)</summary>
        <ul className="kitchen-workflow__channel-list">
          {config.channels.map((ch) => (
            <li key={ch.id}>
              <strong>{ch.label}</strong>
              <span className="kitchen-workflow__channel-count">
                {getCafeWorkflowSteps(ch.id).length} steps
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

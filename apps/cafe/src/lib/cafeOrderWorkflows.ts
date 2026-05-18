import workflowsJson from "../config/workflows/cafe-order-workflows.json";

export type CafeWorkflowStep = {
  code: string;
  label: string;
  sortOrder: number;
  actor?: string;
  systemOnly?: boolean;
  vendorAssignable?: boolean;
  kds?: boolean;
};

export type CafeOrderChannel = {
  id: string;
  label: string;
  lookupCode: string;
  description?: string;
};

export type CafeOrderWorkflowsConfig = {
  version: string;
  channels: CafeOrderChannel[];
  workflows: Record<string, { steps: CafeWorkflowStep[] }>;
  terminalStatuses: string[];
};

const config = workflowsJson as CafeOrderWorkflowsConfig;

export function getCafeOrderWorkflowsConfig(): CafeOrderWorkflowsConfig {
  return config;
}

export function getCafeWorkflowChannel(channelId: string): CafeOrderChannel | undefined {
  return config.channels.find((c) => c.id === channelId || c.lookupCode === channelId);
}

export function getCafeWorkflowSteps(channelId: string): CafeWorkflowStep[] {
  const ch = getCafeWorkflowChannel(channelId);
  const key = ch?.id ?? channelId;
  return config.workflows[key]?.steps ?? [];
}

export function getCafeVendorAssignableCodes(channelId: string): string[] {
  return getCafeWorkflowSteps(channelId)
    .filter((s) => s.vendorAssignable)
    .map((s) => s.code);
}

export function buildCafeWorkflowTimeline(
  channelId: string,
  currentCode: string
): { id: string; label: string; done: boolean; current: boolean }[] {
  const current = currentCode.trim().toLowerCase();
  const steps = getCafeWorkflowSteps(channelId);
  if (config.terminalStatuses.includes(current)) {
    return [
      { id: current, label: current, done: true, current: true },
    ];
  }
  const idx = steps.findIndex((s) => s.code === current);
  const at = idx < 0 ? 0 : idx;
  return steps.map((step, i) => ({
    id: step.code,
    label: step.label,
    done: i <= at,
    current: i === at,
  }));
}

export const CAFE_ORDER_CHANNEL_LOOKUP_TYPE = "order_channel";
export const CAFE_ORDER_STATUS_LOOKUP_TYPE = "cafe_order_status";

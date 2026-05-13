/** Formats minor units (e.g. paise) for storefront cards. */
export function formatMinorAmount(minor: number | null, currency: string | null): string {
  if (minor == null || !Number.isFinite(minor)) return "—";
  const cur = (currency ?? "INR").trim().toUpperCase();
  const major = minor / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(major);
  } catch {
    return `${cur} ${major.toFixed(2)}`;
  }
}

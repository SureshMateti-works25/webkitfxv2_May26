/** Build `wa.me` URL; strips non-digits from phone. */
export function buildWhatsAppChatUrl(phoneDigits: string, message: string): string {
  const digits = phoneDigits.replace(/\D/g, "");
  if (!digits) return "#";
  const q = encodeURIComponent(message.slice(0, 3500));
  return `https://wa.me/${digits}?text=${q}`;
}

/** Replace `{{name}}` tokens with string values (missing keys become empty string). */
export function formatWhatsAppMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => vars[name] ?? "");
}

import { buildWhatsAppChatUrl, formatWhatsAppMessage } from "../lib/whatsappDeepLink.js";

export type WhatsAppFabProps = {
  phoneDigits: string;
  messageTemplate: string;
  vars: Record<string, string>;
  ariaLabel?: string;
  className?: string;
};

/**
 * Floating round button opening WhatsApp with a pre-filled message (config template + vars).
 */
export function WhatsAppFab({ phoneDigits, messageTemplate, vars, ariaLabel, className }: WhatsAppFabProps) {
  const text = formatWhatsAppMessage(messageTemplate, vars);
  const href = buildWhatsAppChatUrl(phoneDigits, text);
  if (href === "#") return null;

  return (
    <a
      className={["whatsapp-fab", className].filter(Boolean).join(" ")}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel ?? "Chat on WhatsApp about this product"}
      title={ariaLabel ?? "WhatsApp"}
    >
      <span className="whatsapp-fab__glyph" aria-hidden>
        <svg viewBox="0 0 32 32" width="28" height="28" fill="currentColor" aria-hidden>
          <path d="M16.003 3C9.385 3 4 8.042 4 14.223c0 2.216.652 4.28 1.781 6.015L4 29l9.02-1.748A11.02 11.02 0 0016.003 25.44 11.56 11.56 0 0028 14.223C28 8.042 22.615 3 16.003 3zm0 20.44c-1.9 0-3.68-.5-5.22-1.37l-.37-.22-5.05.98 1.01-4.92-.24-.39a8.56 8.56 0 01-1.35-4.6c0-5.08 4.58-9.21 10.23-9.21 5.65 0 10.23 4.13 10.23 9.21S21.65 23.44 16.003 23.44zm5.8-6.63c-.32-.16-1.89-.93-2.18-1.04-.29-.1-.5-.16-.71.16s-.82 1.04-1 1.26-.37.24-.68.08-1.33-.49-2.53-1.56c-.94-.84-1.57-1.88-1.76-2.2s-.02-.49.14-.65.32-.37.48-.55.16-.31.24-.52.08-.39-.04-.55-.71-1.7-.97-2.33-.49-.53-.68-.54h-.58c-.18 0-.48.07-.73.37s-.97 1.05-.97 2.56 1 2.97 1.13 3.17c.16.24 1.95 2.98 4.72 4.18.66.28 1.18.45 1.58.58.66.21 1.26.18 1.74.11.53-.08 1.89-.77 2.16-1.51s.27-1.38.19-1.51-.29-.21-.61-.37z" />
        </svg>
      </span>
    </a>
  );
}

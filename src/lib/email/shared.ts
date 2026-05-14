import { env } from "@/lib/env";

export const RESEND_EMAIL_API_URL = "https://api.resend.com/emails";

export type EmailRecipient = {
  email: string;
  kind?: "admin" | "player";
  name?: string;
  playerId?: string;
};

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

export function uniqueRecipients<T extends EmailRecipient>(recipients: T[]) {
  const seen = new Set<string>();

  return recipients.filter((recipient) => {
    const email = normalizeEmail(recipient.email);

    if (!email || seen.has(email)) {
      return false;
    }

    seen.add(email);
    recipient.email = email;
    return true;
  });
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function absoluteUrl(path: string) {
  const baseUrl = env.appUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

export async function sendTransactionalEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}) {
  const response = await fetch(RESEND_EMAIL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from ?? env.emailFrom,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Resend ${response.status}: ${responseText}`);
  }
}

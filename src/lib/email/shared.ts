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

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendTransactionalEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}) {
  const testRecipient = normalizeEmail(env.emailTestRecipient);
  const to = testRecipient ?? args.to;
  const subject = testRecipient
    ? `[TEST -> ${args.to}] ${args.subject}`
    : args.subject;
  const html = testRecipient
    ? `<p><strong>Modo prueba.</strong> Destinatario original: ${escapeHtml(args.to)}</p>\n${args.html}`
    : args.html;
  const text = testRecipient
    ? `Modo prueba. Destinatario original: ${args.to}\n\n${args.text}`
    : args.text;

  const response = await fetch(RESEND_EMAIL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from ?? env.emailFrom,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Resend ${response.status}: ${responseText}`);
  }
}

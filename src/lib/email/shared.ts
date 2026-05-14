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

export function buildEmailLayout(title: string, bodyHtml: string): string {
  const homeUrl = absoluteUrl("/");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f2ea;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f6f2ea;">
    <tr>
      <td align="center" style="padding:40px 16px 32px;">
        <table cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <a href="${homeUrl}" style="text-decoration:none;">
                <span style="font-size:17px;font-weight:900;color:#0d1b2a;letter-spacing:0.1em;text-transform:uppercase;">Escalerilla</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#fffdfa;border-radius:12px;border:1px solid #ded6ca;padding:36px 40px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:20px;">
              <p style="margin:0;font-size:12px;color:#776f66;line-height:1.6;text-align:center;">Correo automático · Club Escalerilla · No responder</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

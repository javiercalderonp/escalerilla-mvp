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
  const logoUrl = absoluteUrl("/logo.png");
  const bannerUrl = absoluteUrl("/imagen-mail.png");

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
      <td align="center" style="padding:32px 16px 24px;">
        <table cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:#0d1b2a;border-radius:12px 12px 0 0;padding:0;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td valign="middle" style="padding:18px 16px 18px 24px;">
                    <a href="${homeUrl}" style="text-decoration:none;">
                      <table cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                          <td valign="middle" style="padding-right:14px;">
                            <img src="${logoUrl}" alt="Club La Dehesa" width="52" height="52" style="display:block;border:0;border-radius:6px;">
                          </td>
                          <td valign="middle">
                            <span style="font-size:15px;font-weight:900;color:#ffffff;letter-spacing:0.03em;text-transform:uppercase;display:block;line-height:1.2;">Club de Golf La Dehesa</span>
                            <span style="font-size:10px;font-weight:700;color:#e8720c;letter-spacing:0.14em;text-transform:uppercase;display:block;margin-top:5px;">Escalerilla Tenis</span>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                  <td align="right" valign="top" style="padding:0;line-height:0;font-size:0;width:220px;">
                    <img src="${bannerUrl}" alt="" width="220" height="88" style="display:block;border:0;border-radius:0 12px 0 0;" role="presentation">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:0 0 12px 12px;padding:40px 40px 36px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 0 16px;">
              <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#0d1b2a;text-align:center;letter-spacing:0.02em;">Escalerilla de Tenis · Club de Golf La Dehesa</p>
              <table align="center" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:0 5px;"><a href="${homeUrl}" style="display:block;width:34px;height:34px;background-color:#dedad4;border-radius:50%;text-align:center;line-height:34px;font-size:11px;font-weight:700;text-decoration:none;color:#0d1b2a;">IG</a></td>
                  <td style="padding:0 5px;"><a href="${homeUrl}" style="display:block;width:34px;height:34px;background-color:#dedad4;border-radius:50%;text-align:center;line-height:34px;font-size:11px;font-weight:700;text-decoration:none;color:#0d1b2a;">WA</a></td>
                  <td style="padding:0 5px;"><a href="${homeUrl}" style="display:block;width:34px;height:34px;background-color:#dedad4;border-radius:50%;text-align:center;line-height:34px;font-size:11px;font-weight:700;text-decoration:none;color:#0d1b2a;">WEB</a></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#0d1b2a;border-radius:8px;padding:14px 20px;">
              <p style="margin:0;font-size:12px;color:#8a9aaa;text-align:center;">Correo automático · Club Escalerilla · No responder</p>
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

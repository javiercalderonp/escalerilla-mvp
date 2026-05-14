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
  <style>
    @media only screen and (max-width:480px){
      .em-col-half{display:block!important;width:100%!important;box-sizing:border-box!important;border-right:none!important;}
      .em-col-third{display:block!important;width:100%!important;box-sizing:border-box!important;border-right:none!important;padding-top:16px!important;}
      .em-col-42{display:block!important;width:100%!important;box-sizing:border-box!important;}
      .em-col-16{display:block!important;width:100%!important;box-sizing:border-box!important;border-left:none!important;border-right:none!important;}
      .em-full-btn{display:block!important;width:100%!important;box-sizing:border-box!important;padding-left:0!important;padding-right:0!important;}
      .em-mobile-cta{display:block!important;width:auto!important;padding-top:12px!important;text-align:center!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fb;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f5f7fb;">
    <tr>
      <td align="center" style="padding:16px 8px 24px;">
        <table cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:#07182a;border:1px solid #e5eaf0;">
          <tr>
            <td background="${bannerUrl}" style="background-color:#07182a;background-image:linear-gradient(90deg,rgba(7,24,42,0.94) 0%,rgba(7,24,42,0.82) 38%,rgba(7,24,42,0.34) 72%,rgba(7,24,42,0.08) 100%),url('${bannerUrl}');background-size:cover;background-position:center;height:154px;padding:0 40px;">
              <a href="${homeUrl}" style="text-decoration:none;">
                <table cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td valign="middle" style="padding-right:22px;">
                      <img src="${logoUrl}" alt="Club de Golf La Dehesa" width="70" height="70" style="display:block;border:0;border-radius:4px;">
                    </td>
                    <td valign="middle">
                      <div style="font-size:24px;font-weight:900;color:#ffffff;line-height:1.1;text-transform:uppercase;">Club de Golf La Dehesa</div>
                      <div style="font-size:16px;font-weight:800;color:#ff7a1a;line-height:1.4;text-transform:uppercase;">Escalerilla Tenis</div>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 28px 0;background:#07182a;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:-32px;background:#ffffff;border-radius:8px;box-shadow:0 14px 36px rgba(15,28,42,0.14);">
                <tr>
                  <td style="padding:40px 40px 36px;">
                    ${bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#07182a;padding:24px 0 16px;">
              <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#ffffff;text-align:center;letter-spacing:0.02em;">Escalerilla de Tenis · Club de Golf La Dehesa</p>
              <table align="center" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:0 5px;"><a href="${homeUrl}" style="display:block;width:34px;height:34px;background-color:#ffffff;border-radius:50%;text-align:center;line-height:34px;font-size:11px;font-weight:700;text-decoration:none;color:#07182a;">IG</a></td>
                  <td style="padding:0 5px;"><a href="${homeUrl}" style="display:block;width:34px;height:34px;background-color:#ffffff;border-radius:50%;text-align:center;line-height:34px;font-size:11px;font-weight:700;text-decoration:none;color:#07182a;">WA</a></td>
                  <td style="padding:0 5px;"><a href="${homeUrl}" style="display:block;width:34px;height:34px;background-color:#ffffff;border-radius:50%;text-align:center;line-height:34px;font-size:11px;font-weight:700;text-decoration:none;color:#07182a;">WEB</a></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#082033;padding:14px 20px;">
              <p style="margin:0;font-size:12px;color:#cbd5e1;text-align:center;">Correo automático · Club Escalerilla · No responder</p>
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

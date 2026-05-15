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
      .em-shell-gutter{padding-left:10px!important;padding-right:10px!important;}
      .em-card-gutter{padding-left:10px!important;padding-right:10px!important;}
      .em-card-pad{padding:20px 12px 24px!important;}
      .em-hero{height:98px!important;padding-left:16px!important;padding-right:16px!important;}
      .em-hero-logo{width:42px!important;height:42px!important;}
      .em-hero-logo-cell{padding-right:10px!important;}
      .em-hero-brand{margin-top:-8px!important;}
      .em-hero-title{font-size:15px!important;line-height:1.08!important;}
      .em-hero-subtitle{font-size:10px!important;line-height:1.2!important;}
      .em-body-card{margin-top:-18px!important;}
      .em-email-heading,.em-draw-heading{margin-bottom:14px!important;}
      .em-email-kicker,.em-draw-kicker{margin-bottom:8px!important;font-size:10px!important;letter-spacing:0.08em!important;line-height:1.2!important;}
      .em-email-title,.em-draw-title{font-size:22px!important;line-height:1.12!important;}
      .em-email-title-large{font-size:23px!important;line-height:1.1!important;}
      .em-email-icon{margin-bottom:8px!important;font-size:21px!important;}
      .em-email-rule,.em-draw-rule{width:32px!important;height:3px!important;margin-top:9px!important;}
      .em-email-greeting,.em-draw-greeting{margin-bottom:2px!important;font-size:13px!important;line-height:1.35!important;}
      .em-email-intro,.em-draw-intro{margin-bottom:14px!important;font-size:12px!important;line-height:1.45!important;}
      .em-email-section-label{margin-bottom:12px!important;font-size:10px!important;}
      .em-match-score{font-size:30px!important;white-space:nowrap!important;}
      .em-email-icon-card{width:44px!important;height:44px!important;margin-bottom:8px!important;font-size:20px!important;line-height:44px!important;}
      .em-email-action{padding:12px 18px!important;font-size:13px!important;}
      .em-email-action-large{padding:13px 18px!important;font-size:15px!important;}
      .em-email-panel-pad{padding:16px 14px!important;}
      .em-col-half{display:block!important;width:100%!important;box-sizing:border-box!important;border-right:none!important;}
      .em-col-third{display:block!important;width:100%!important;box-sizing:border-box!important;border-right:none!important;padding-top:16px!important;}
      .em-match-card{table-layout:fixed!important;}
      .em-match-player{display:table-cell!important;width:40%!important;box-sizing:border-box!important;padding:10px 5px!important;}
      .em-match-center{display:table-cell!important;width:20%!important;box-sizing:border-box!important;padding:10px 3px!important;border-left:1px solid #edf0f5!important;border-right:1px solid #edf0f5!important;}
      .em-player-avatar-cell{display:block!important;width:100%!important;padding:0 0 7px!important;text-align:center!important;}
      .em-player-avatar{width:46px!important;height:46px!important;margin:0 auto!important;font-size:17px!important;line-height:46px!important;}
      .em-player-info{display:block!important;width:100%!important;text-align:center!important;}
      .em-player-name{margin-bottom:5px!important;font-size:13px!important;line-height:1.1!important;}
      .em-ranking-label{margin-bottom:1px!important;font-size:10px!important;line-height:1.15!important;}
      .em-ranking-value{font-size:18px!important;}
      .em-form-card{margin-top:9px!important;border-radius:6px!important;}
      .em-form-card-pad{padding:8px 3px!important;}
      .em-form-title{margin-bottom:5px!important;font-size:8px!important;line-height:1.1!important;}
      .em-form-row{margin-bottom:5px!important;white-space:nowrap!important;}
      .em-form-dot{width:15px!important;height:15px!important;margin:0 1px!important;font-size:8px!important;line-height:15px!important;}
      .em-form-text{font-size:9px!important;line-height:1.2!important;}
      .em-vs-badge{width:32px!important;height:32px!important;margin-bottom:10px!important;line-height:32px!important;font-size:12px!important;}
      .em-h2h-label{font-size:9px!important;}
      .em-h2h-score{font-size:17px!important;}
      .em-h2h-leader{font-size:9px!important;}
      .em-time-block{display:block!important;width:100%!important;box-sizing:border-box!important;border-right:none!important;border-bottom:1px solid #edf0f5!important;}
      .em-time-block-last{border-bottom:none!important;}
      .em-full-btn{display:block!important;width:100%!important;box-sizing:border-box!important;padding-left:0!important;padding-right:0!important;}
      .em-mobile-cta{display:block!important;width:auto!important;padding-top:12px!important;text-align:center!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fb;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f5f7fb;">
    <tr>
      <td align="center" class="em-shell-gutter" style="padding:16px 8px 24px;">
        <table cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:#07182a;border:1px solid #e5eaf0;">
          <tr>
            <td background="${bannerUrl}" class="em-hero" style="background-color:#07182a;background-image:linear-gradient(90deg,rgba(7,24,42,0.94) 0%,rgba(7,24,42,0.82) 38%,rgba(7,24,42,0.34) 72%,rgba(7,24,42,0.08) 100%),url('${bannerUrl}');background-size:cover;background-position:center;height:154px;padding:0 40px;">
              <a href="${homeUrl}" style="text-decoration:none;">
                <table cellpadding="0" cellspacing="0" role="presentation" class="em-hero-brand">
                  <tr>
                    <td valign="middle" class="em-hero-logo-cell" style="padding-right:22px;">
                      <img src="${logoUrl}" alt="Club de Golf La Dehesa" width="70" height="70" class="em-hero-logo" style="display:block;border:0;border-radius:4px;">
                    </td>
                    <td valign="middle">
                      <div class="em-hero-title" style="font-size:24px;font-weight:900;color:#ffffff;line-height:1.1;text-transform:uppercase;">Club de Golf La Dehesa</div>
                      <div class="em-hero-subtitle" style="font-size:16px;font-weight:800;color:#ff7a1a;line-height:1.4;text-transform:uppercase;">Escalerilla Tenis</div>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" class="em-card-gutter" style="padding:0 28px 0;background:#07182a;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="em-body-card" style="margin-top:-32px;background:#ffffff;border-radius:8px;box-shadow:0 14px 36px rgba(15,28,42,0.14);">
                <tr>
                  <td class="em-card-pad" style="padding:40px 40px 36px;">
                    ${bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#07182a;padding:24px 0 16px;">
              <img src="${logoUrl}" alt="Club de Golf La Dehesa" width="58" height="58" style="display:block;border:0;border-radius:4px;margin:0 auto 12px;">
              <p style="margin:0;font-size:13px;font-weight:600;color:#ffffff;text-align:center;letter-spacing:0.02em;">Escalerilla de Tenis · Club de Golf La Dehesa</p>
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

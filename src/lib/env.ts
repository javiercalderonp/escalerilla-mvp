const splitEmails = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  authSecret: process.env.AUTH_SECRET ?? "",
  googleClientId: process.env.AUTH_GOOGLE_ID ?? "",
  googleClientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
  adminEmails: splitEmails(process.env.ADMIN_EMAILS),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  matchResultEmailsEnabled: process.env.MATCH_RESULT_EMAILS_ENABLED === "true",
  matchResultEmailFrom: process.env.MATCH_RESULT_EMAIL_FROM ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
};

export const isAdminEmail = (email?: string | null) => {
  if (!email) {
    return false;
  }

  return env.adminEmails.includes(email.toLowerCase());
};

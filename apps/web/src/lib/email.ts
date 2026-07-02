import "server-only";

import { db, emailLogs, emailTemplates, smtpSettings } from "@judilen/db";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { decryptCredentials } from "./credential-cipher";
import { DEFAULT_EMAIL_TEMPLATES, type EmailTemplateKey } from "./email-templates";
import { getSiteTheme } from "./site-theme-db";

export const SMTP_SETTINGS_ID = "00000000-0000-0000-0000-000000000002";

export type EmailVariables = Partial<Record<
  "customerName" | "bookingNumber" | "houseName" | "checkInDate" | "checkOutDate" |
  "totalPrice" | "bookingStatus" | "loginUrl" | "reviewUrl" | "resetPasswordUrl" |
  "siteName" | "contactPhone", string
>>;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]!);
}

export function renderEmailTemplate(content: string, variables: EmailVariables, html = false) {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key as keyof EmailVariables] ?? "";
    return html ? escapeHtml(value) : value;
  });
}

export async function getSmtpSettings() {
  const [stored] = await db.select().from(smtpSettings).where(eq(smtpSettings.id, SMTP_SETTINGS_ID)).limit(1);
  if (stored) return stored;
  if (!process.env.SMTP_HOST) return null;
  return {
    id: SMTP_SETTINGS_ID,
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    username: process.env.SMTP_USER ?? null,
    passwordEncrypted: null,
    encryption: Number(process.env.SMTP_PORT) === 465 ? "ssl" : "starttls",
    fromEmail: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
    fromName: "Усадьба «Юдилен»",
    replyToEmail: null,
    status: "environment",
    lastError: null,
    lastCheckedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

async function createTransport() {
  const settings = await getSmtpSettings();
  if (!settings?.host || !settings.fromEmail) throw new Error("SMTP не настроен");
  const encrypted = settings.passwordEncrypted ? decryptCredentials(settings.passwordEncrypted) : {};
  const password = encrypted.password ?? process.env.SMTP_PASSWORD;
  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.encryption === "ssl",
    requireTLS: settings.encryption === "starttls",
    ignoreTLS: settings.encryption === "none",
    auth: settings.username ? { user: settings.username, pass: password } : undefined
  });
  return { transport, settings };
}

export async function verifySmtpConnection() {
  const { transport } = await createTransport();
  await transport.verify();
}

async function loadTemplate(key: EmailTemplateKey) {
  const [stored] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, key)).limit(1);
  return stored ?? DEFAULT_EMAIL_TEMPLATES[key];
}

function emailShell(content: string, colors: Awaited<ReturnType<typeof getSiteTheme>>, baseUrl: string) {
  return `<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:${colors.backgroundColor};color:${colors.textColor};font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:24px 12px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:auto;background:${colors.cardColor};border-radius:16px;overflow:hidden">
  <tr><td style="padding:22px;background:${colors.headerColor};color:${colors.primaryColor};font-size:22px;font-weight:700">
  <img src="${baseUrl}/icons/admin-192.png" width="36" height="36" alt="" style="vertical-align:middle;border-radius:8px;margin-right:10px">Усадьба «Юдилен»</td></tr>
  <tr><td style="padding:32px;line-height:1.6">${content}</td></tr>
  <tr><td style="padding:20px;background:${colors.footerColor};color:#fff;font-size:12px">Усадьба «Юдилен» · {{contactPhone}}</td></tr>
  </table></td></tr></table><style>.button{display:inline-block;padding:12px 20px;border-radius:999px;background:${colors.buttonColor};color:#fff!important;text-decoration:none;font-weight:700}@media(max-width:480px){td{padding-left:18px!important;padding-right:18px!important}}</style></body></html>`;
}

export async function sendTemplatedEmail(options: {
  to: string;
  templateKey: EmailTemplateKey;
  variables?: EmailVariables;
  bookingId?: string;
  dedupeKey: string;
}) {
  const template = await loadTemplate(options.templateKey);
  const baseUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const variables: EmailVariables = {
    siteName: "Усадьба «Юдилен»",
    contactPhone: process.env.CONTACT_PHONE ?? "+375 29 673 35 46",
    loginUrl: `${baseUrl}/login`,
    reviewUrl: `${baseUrl}/otzyvy/novyi`,
    ...options.variables
  };
  const subject = renderEmailTemplate(template.subject, variables);
  const [log] = await db.insert(emailLogs).values({
    recipient: options.to,
    templateKey: options.templateKey,
    subject,
    bookingId: options.bookingId,
    dedupeKey: options.dedupeKey
  }).onConflictDoNothing().returning({ id: emailLogs.id });
  if (!log) return { sent: false, duplicate: true };

  try {
    const [{ transport, settings }, colors] = await Promise.all([createTransport(), getSiteTheme()]);
    const htmlBody = renderEmailTemplate(template.htmlContent, variables, true);
    const html = renderEmailTemplate(emailShell(htmlBody, colors, baseUrl), variables, true);
    await transport.sendMail({
      from: { name: settings.fromName, address: settings.fromEmail },
      replyTo: settings.replyToEmail ?? undefined,
      to: options.to,
      subject,
      text: renderEmailTemplate(template.textContent, variables),
      html
    });
    await db.update(emailLogs).set({ status: "sent", sentAt: new Date() }).where(eq(emailLogs.id, log.id));
    return { sent: true, duplicate: false };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Неизвестная ошибка SMTP";
    await db.update(emailLogs).set({ status: "failed", errorMessage: message }).where(eq(emailLogs.id, log.id));
    return { sent: false, duplicate: false, error: message };
  }
}

export function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendTemplatedEmail({
    to,
    templateKey: "password_reset",
    variables: { resetPasswordUrl: resetUrl },
    dedupeKey: `password-reset:${to}:${new URL(resetUrl).searchParams.get("token")}`
  });
}

import nodemailer from "nodemailer";

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP_HOST is required in production");
    console.info("Development password reset URL", resetUrl);
    return;
  }
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Восстановление доступа к усадьбе «Юдилен»",
    text: `Для установки нового пароля откройте ссылку: ${resetUrl}\n\nСсылка действует 60 минут.`,
    html: `<p>Для установки нового пароля откройте ссылку:</p><p><a href="${resetUrl}">Восстановить доступ</a></p><p>Ссылка действует 60 минут.</p>`
  });
}


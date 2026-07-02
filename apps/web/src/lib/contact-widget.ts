import { z } from "zod";

export const contactWidgetChannelTypes = ["telegram", "viber", "whatsapp", "instagram", "website"] as const;
export type ContactWidgetChannelType = typeof contactWidgetChannelTypes[number];

export const contactWidgetChannelSchema = z.object({
  channelType: z.enum(contactWidgetChannelTypes),
  enabled: z.boolean(),
  displayName: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(160).default(""),
  url: z.string().trim().max(500).default(""),
  phone: z.string().trim().max(40).default(""),
  username: z.string().trim().max(100).default(""),
  defaultMessage: z.string().trim().max(1000).default(""),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  icon: z.string().trim().max(80).default("")
});

export const contactWidgetSettingsSchema = z.object({
  channels: z.array(contactWidgetChannelSchema).length(contactWidgetChannelTypes.length)
}).superRefine((value, context) => {
  const unique = new Set(value.channels.map((channel) => channel.channelType));
  if (unique.size !== contactWidgetChannelTypes.length) {
    context.addIssue({ code: "custom", message: "Каждый канал должен встречаться один раз" });
  }
  for (const channel of value.channels) {
    if (channel.enabled && !buildContactChannelUrl(channel)) {
      context.addIssue({
        code: "custom",
        path: ["channels", value.channels.indexOf(channel)],
        message: `Канал ${channel.displayName} настроен некорректно`
      });
    }
  }
});

type ChannelInput = z.infer<typeof contactWidgetChannelSchema>;

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^\d{7,15}$/.test(digits) ? digits : "";
}

function webUrl(value: string, hostname: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === hostname || url.hostname === `www.${hostname}`)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function buildContactChannelUrl(channel: ChannelInput): string | null {
  if (channel.channelType === "website") return channel.defaultMessage ? "website" : null;
  if (channel.channelType === "telegram") {
    const direct = webUrl(channel.url, "t.me");
    if (direct) return direct;
    const username = channel.username.replace(/^@/, "");
    return /^[A-Za-z0-9_]{5,32}$/.test(username) ? `https://t.me/${username}` : null;
  }
  if (channel.channelType === "instagram") {
    const direct = webUrl(channel.url, "instagram.com");
    if (direct) return direct;
    const username = channel.username.replace(/^@/, "");
    return /^[A-Za-z0-9._]{1,30}$/.test(username) ? `https://instagram.com/${username}` : null;
  }
  if (channel.channelType === "whatsapp") {
    const phone = phoneDigits(channel.phone);
    if (!phone) return null;
    const message = channel.defaultMessage ? `?text=${encodeURIComponent(channel.defaultMessage)}` : "";
    return `https://wa.me/${phone}${message}`;
  }
  if (/^viber:\/\/chat\?number=(?:%2B|\+)?\d{7,15}$/i.test(channel.url)) return channel.url;
  const phone = phoneDigits(channel.phone);
  return phone ? `viber://chat?number=%2B${phone}` : null;
}

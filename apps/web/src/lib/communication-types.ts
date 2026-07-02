export const communicationProviders = [
  "telegram",
  "telegram_group",
  "vk",
  "instagram",
  "whatsapp",
  "viber"
] as const;

export type CommunicationProvider = typeof communicationProviders[number];

export type CommunicationField = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
};

export const communicationProviderDefinitions: Record<CommunicationProvider, {
  label: string;
  description: string;
  publicFields: CommunicationField[];
  secretFields: CommunicationField[];
}> = {
  telegram: {
    label: "Telegram",
    description: "Личные сообщения Telegram-боту.",
    publicFields: [],
    secretFields: [{ key: "botToken", label: "Токен бота", placeholder: "123456:ABC...", required: true }]
  },
  telegram_group: {
    label: "Telegram-группа",
    description: "Сообщения группы с добавленным ботом.",
    publicFields: [{ key: "groupId", label: "ID группы", placeholder: "-1001234567890", required: true }],
    secretFields: [{ key: "botToken", label: "Токен бота", placeholder: "123456:ABC...", required: true }]
  },
  vk: {
    label: "VK",
    description: "Сообщения сообщества через Callback API.",
    publicFields: [{ key: "groupId", label: "ID сообщества", required: true }],
    secretFields: [
      { key: "accessToken", label: "Токен сообщества", required: true },
      { key: "callbackSecret", label: "Секрет Callback API" },
      { key: "confirmationCode", label: "Строка подтверждения Callback API", required: true }
    ]
  },
  instagram: {
    label: "Instagram",
    description: "Instagram Messaging API для профессионального аккаунта.",
    publicFields: [{ key: "accountId", label: "Instagram Account ID", required: true }],
    secretFields: [
      { key: "accessToken", label: "Access Token", required: true },
      { key: "appSecret", label: "Meta App Secret" }
    ]
  },
  whatsapp: {
    label: "WhatsApp",
    description: "WhatsApp Cloud API.",
    publicFields: [
      { key: "phoneNumberId", label: "Phone Number ID", required: true },
      { key: "businessAccountId", label: "Business Account ID" }
    ],
    secretFields: [
      { key: "accessToken", label: "Access Token", required: true },
      { key: "appSecret", label: "Meta App Secret" }
    ]
  },
  viber: {
    label: "Viber",
    description: "Viber Bot API. Новые боты доступны на коммерческих условиях.",
    publicFields: [{ key: "botName", label: "Имя бота", placeholder: "Юдилен" }],
    secretFields: [{ key: "authToken", label: "Authentication Token", required: true }]
  }
};

export function isCommunicationProvider(value: string): value is CommunicationProvider {
  return communicationProviders.includes(value as CommunicationProvider);
}

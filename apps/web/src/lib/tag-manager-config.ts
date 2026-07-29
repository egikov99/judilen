import { z } from "zod";

export const TAG_MANAGER_CODE_LIMIT = 20_000;

export const DEFAULT_TAG_MANAGER_SETTINGS = {
  tagManagerEnabled: false,
  tagManagerHeadCode: "",
  tagManagerBodyCode: ""
};

const layoutBreakingMarkup = /<\s*\/?\s*(?:html|head|body|style|base)\b/i;
const stylesheetLink = /<\s*link\b[^>]*\brel\s*=\s*["']?stylesheet\b/i;
const allowedTagNames = new Set(["script", "noscript", "iframe", "img", "meta", "link", "div"]);

function safeTagManagerMarkup(code: string) {
  if (layoutBreakingMarkup.test(code) || stylesheetLink.test(code) || /<!doctype\b/i.test(code)) return false;
  return [...code.matchAll(/<\s*\/?\s*([a-z][\w:-]*)\b/gi)]
    .every((match) => allowedTagNames.has(match[1].toLowerCase()));
}

const tagManagerCodeSchema = z.string()
  .max(TAG_MANAGER_CODE_LIMIT, "Код не должен превышать 20 000 символов")
  .refine(safeTagManagerMarkup, "Разрешены только служебные теги аналитики без структурных тегов страницы и подключения CSS");

export const tagManagerSettingsSchema = z.object({
  tagManagerEnabled: z.boolean().default(false),
  tagManagerHeadCode: tagManagerCodeSchema.default(""),
  tagManagerBodyCode: tagManagerCodeSchema.default("")
}).strict();

export type TagManagerSettings = z.infer<typeof tagManagerSettingsSchema>;

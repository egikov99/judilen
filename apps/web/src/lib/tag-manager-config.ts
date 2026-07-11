import { z } from "zod";

export const TAG_MANAGER_CODE_LIMIT = 20_000;

export const DEFAULT_TAG_MANAGER_SETTINGS = {
  tagManagerEnabled: false,
  tagManagerHeadCode: "",
  tagManagerBodyCode: ""
};

export const tagManagerSettingsSchema = z.object({
  tagManagerEnabled: z.boolean().default(false),
  tagManagerHeadCode: z.string().max(TAG_MANAGER_CODE_LIMIT, "Код в <head> не должен превышать 20 000 символов").default(""),
  tagManagerBodyCode: z.string().max(TAG_MANAGER_CODE_LIMIT, "Код после открытия <body> не должен превышать 20 000 символов").default("")
}).strict();

export type TagManagerSettings = z.infer<typeof tagManagerSettingsSchema>;

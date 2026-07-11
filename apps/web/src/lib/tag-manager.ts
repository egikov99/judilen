import "server-only";

import { db, settings } from "@judilen/db";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import {
  DEFAULT_TAG_MANAGER_SETTINGS,
  TAG_MANAGER_CODE_LIMIT,
  tagManagerSettingsSchema,
  type TagManagerSettings
} from "./tag-manager-config";
export { DEFAULT_TAG_MANAGER_SETTINGS, TAG_MANAGER_CODE_LIMIT, tagManagerSettingsSchema };

export const TAG_MANAGER_SETTINGS_KEY = "site.tag_manager";
export const TAG_MANAGER_CACHE_TAG = "site-tag-manager";

function parseSettings(value: unknown): TagManagerSettings {
  const result = tagManagerSettingsSchema.safeParse(value);
  return result.success ? result.data : { ...DEFAULT_TAG_MANAGER_SETTINGS };
}

async function loadTagManagerSettings() {
  const [row] = await db.select({ value: settings.value }).from(settings)
    .where(eq(settings.key, TAG_MANAGER_SETTINGS_KEY))
    .limit(1);
  return parseSettings(row?.value);
}

const cachedTagManagerSettings = unstable_cache(loadTagManagerSettings, [TAG_MANAGER_SETTINGS_KEY], {
  tags: [TAG_MANAGER_CACHE_TAG],
  revalidate: false
});

export async function getTagManagerSettings(): Promise<TagManagerSettings> {
  try {
    return await cachedTagManagerSettings();
  } catch {
    return { ...DEFAULT_TAG_MANAGER_SETTINGS };
  }
}

export async function saveTagManagerSettings(input: TagManagerSettings) {
  const value = tagManagerSettingsSchema.parse(input);
  const [saved] = await db.insert(settings).values({
    key: TAG_MANAGER_SETTINGS_KEY,
    value,
    isSecret: false
  }).onConflictDoUpdate({
    target: settings.key,
    set: { value, isSecret: false, updatedAt: new Date() }
  }).returning({ value: settings.value });
  revalidateTag(TAG_MANAGER_CACHE_TAG, "max");
  revalidatePath("/", "layout");
  return parseSettings(saved.value);
}

import { getTagManagerSettings } from "@/lib/tag-manager";
import { TagManagerRuntime } from "@/components/tag-manager-runtime";

export async function TagManagerInjector() {
  const settings = await getTagManagerSettings();
  if (!settings.tagManagerEnabled) return null;
  const headCode = settings.tagManagerHeadCode.trim();
  const bodyCode = settings.tagManagerBodyCode.trim();
  if (!headCode && !bodyCode) return null;

  return <TagManagerRuntime headCode={headCode} bodyCode={bodyCode} />;
}

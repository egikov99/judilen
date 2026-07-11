import { getTagManagerSettings } from "@/lib/tag-manager";

function RawTagManagerHtml({ html }: { html: string }) {
  // This is the only intentional raw HTML injection point for administrator-provided analytics code.
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function RawTagManagerHead({ html }: { html: string }) {
  // This is the only intentional raw HTML injection point for administrator-provided analytics code.
  // eslint-disable-next-line @next/next/no-head-element
  return <head dangerouslySetInnerHTML={{ __html: html }} />;
}

export async function TagManagerInjector() {
  const settings = await getTagManagerSettings();
  if (!settings.tagManagerEnabled) return null;
  const headCode = settings.tagManagerHeadCode.trim();
  const bodyCode = settings.tagManagerBodyCode.trim();
  if (!headCode && !bodyCode) return null;

  return <>
    {headCode && <RawTagManagerHead html={headCode} />}
    {bodyCode && <RawTagManagerHtml html={bodyCode} />}
  </>;
}

export function createEntityImageUploadForm(
  files: File[],
  entity: { key: "houseId" | "serviceId" | "gazeboId"; id: string },
  metadata: { alt?: string; caption?: string } = {}
) {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  form.set(entity.key, entity.id);
  form.set("alt", metadata.alt?.trim() ?? "");
  if (metadata.caption !== undefined) form.set("caption", metadata.caption.trim());
  return form;
}

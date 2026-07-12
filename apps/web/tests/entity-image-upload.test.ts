import { describe, expect, it } from "vitest";
import { createEntityImageUploadForm } from "@/lib/entity-image-upload";

function imageFiles(count: number) {
  return Array.from({ length: count }, (_, index) => new File(
    [new Uint8Array([0xff, 0xd8, 0xff, index])],
    `photo-${index + 1}.jpg`,
    { type: "image/jpeg" }
  ));
}

describe("entity image upload form", () => {
  it.each([1, 4, 10])("adds all %i selected files to one multipart body", (count) => {
    const form = createEntityImageUploadForm(
      imageFiles(count),
      { key: "houseId", id: "house-id" },
      { alt: "", caption: "Подпись" }
    );
    expect(form.getAll("files")).toHaveLength(count);
    expect(form.get("houseId")).toBe("house-id");
    expect(form.get("alt")).toBe("");
    expect(form.get("caption")).toBe("Подпись");
  });

  it("uses the service entity field expected by the backend", () => {
    const form = createEntityImageUploadForm(imageFiles(4), { key: "serviceId", id: "service-id" });
    expect(form.get("serviceId")).toBe("service-id");
    expect(form.getAll("files")).toHaveLength(4);
  });

  it("uses the gazebo entity field expected by the backend", () => {
    const form = createEntityImageUploadForm(imageFiles(3), { key: "gazeboId", id: "gazebo-id" });
    expect(form.get("gazeboId")).toBe("gazebo-id");
    expect(form.getAll("files")).toHaveLength(3);
  });
});

// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TagManagerRuntime } from "@/components/tag-manager-runtime";

afterEach(cleanup);

describe("tag manager runtime", () => {
  it("places snippets in head and body without adding a layout wrapper", async () => {
    const view = render(createElement(TagManagerRuntime, {
      headCode: '<meta name="tag-manager-test" content="head">',
      bodyCode: '<img data-tag-manager-test="body" alt="" src="data:,"><div data-tag-manager-test="fallback">pixel</div>'
    }));

    await waitFor(() => expect(document.head.querySelector('meta[name="tag-manager-test"]')).toBeTruthy());
    expect(document.body.querySelector('img[data-tag-manager-test="body"]')).toBeTruthy();
    expect((document.body.querySelector('div[data-tag-manager-test="fallback"]') as HTMLDivElement).hidden).toBe(true);
    expect(view.container.innerHTML).toBe("");

    view.unmount();
    expect(document.head.querySelector('meta[name="tag-manager-test"]')).toBeNull();
    expect(document.body.querySelector('img[data-tag-manager-test="body"]')).toBeNull();
  });

  it("moves a noscript fallback from a complete head snippet into the body", async () => {
    const view = render(createElement(TagManagerRuntime, {
      headCode: '<meta name="complete-snippet" content="head"><noscript><div><img alt="" src="data:," /></div></noscript>',
      bodyCode: ""
    }));

    await waitFor(() => expect(document.head.querySelector('meta[name="complete-snippet"]')).toBeTruthy());
    expect(document.head.querySelector("noscript")).toBeNull();
    expect(document.body.querySelector("noscript")).toBeTruthy();
    view.unmount();
  });
});

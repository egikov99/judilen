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
    expect(document.head.firstElementChild).toBe(document.head.querySelector('meta[name="tag-manager-test"]'));
    expect(document.body.firstElementChild).toBe(document.body.querySelector('img[data-tag-manager-test="body"]'));
    expect((document.body.querySelector('div[data-tag-manager-test="fallback"]') as HTMLDivElement).hidden).toBe(false);
    expect(view.container.innerHTML).toBe("");

    view.unmount();
    expect(document.head.querySelector('meta[name="tag-manager-test"]')).toBeNull();
    expect(document.body.querySelector('img[data-tag-manager-test="body"]')).toBeNull();
  });

  it("keeps a complete head snippet together and in its original order", async () => {
    const view = render(createElement(TagManagerRuntime, {
      headCode: '<!-- snippet-start --><script type="application/json">{"counter":1}</script><noscript><div><img alt="" src="data:," /></div></noscript><!-- snippet-end -->',
      bodyCode: ""
    }));

    await waitFor(() => expect(document.head.querySelector('script[type="application/json"]')).toBeTruthy());
    expect(document.head.childNodes[0].nodeType).toBe(Node.COMMENT_NODE);
    expect(document.head.childNodes[0].textContent?.trim()).toBe("snippet-start");
    expect((document.head.childNodes[1] as HTMLElement).tagName).toBe("SCRIPT");
    expect((document.head.childNodes[2] as HTMLElement).tagName).toBe("NOSCRIPT");
    expect(document.head.childNodes[3].nodeType).toBe(Node.COMMENT_NODE);
    expect(document.head.childNodes[3].textContent?.trim()).toBe("snippet-end");
    expect(document.body.querySelector("noscript")).toBeNull();
    view.unmount();
  });
});

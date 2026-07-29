"use client";

import { useEffect } from "react";

function executableClone(node: Node): Node {
  if (node instanceof HTMLScriptElement) {
    const script = document.createElement("script");
    for (const attribute of node.attributes) script.setAttribute(attribute.name, attribute.value);
    script.textContent = node.textContent;
    return script;
  }
  const clone = node.cloneNode(false);
  for (const child of node.childNodes) clone.appendChild(executableClone(child));
  return clone;
}

function injectSnippet(target: HTMLElement, html: string) {
  if (!html.trim()) return () => undefined;
  const template = document.createElement("template");
  template.innerHTML = html;
  const injected: Node[] = [];
  const anchors = new Map<HTMLElement, Comment>();
  const anchorFor = (destination: HTMLElement) => {
    const existing = anchors.get(destination);
    if (existing) return existing;
    const anchor = document.createComment("judilen-tag-manager");
    destination.insertBefore(anchor, destination.firstChild);
    anchors.set(destination, anchor);
    return anchor;
  };
  for (const node of template.content.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) continue;
    if (node.nodeType === Node.TEXT_NODE) continue;
    const clone = executableClone(node);
    target.insertBefore(clone, anchorFor(target));
    injected.push(clone);
  }
  return () => {
    injected.forEach((node) => node.parentNode?.removeChild(node));
    anchors.forEach((anchor) => anchor.parentNode?.removeChild(anchor));
  };
}

export function TagManagerRuntime({ headCode, bodyCode }: { headCode: string; bodyCode: string }) {
  useEffect(() => {
    const removeHead = injectSnippet(document.head, headCode);
    const removeBody = injectSnippet(document.body, bodyCode);
    return () => {
      removeHead();
      removeBody();
    };
  }, [headCode, bodyCode]);
  return null;
}

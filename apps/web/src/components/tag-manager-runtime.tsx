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

function injectSnippet(target: HTMLElement, html: string, bodyFallback?: HTMLElement) {
  if (!html.trim()) return () => undefined;
  const template = document.createElement("template");
  template.innerHTML = html;
  const injected: Node[] = [];
  for (const node of template.content.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) continue;
    if (node.nodeType === Node.TEXT_NODE) continue;
    const clone = executableClone(node);
    if (clone instanceof HTMLElement) {
      clone.dataset.judilenTagManager = "true";
      if (clone.tagName === "DIV") clone.hidden = true;
    }
    const destination = bodyFallback && clone instanceof HTMLElement && ["NOSCRIPT", "IFRAME", "IMG", "DIV"].includes(clone.tagName)
      ? bodyFallback
      : target;
    destination.appendChild(clone);
    injected.push(clone);
  }
  return () => injected.forEach((node) => node.parentNode?.removeChild(node));
}

export function TagManagerRuntime({ headCode, bodyCode }: { headCode: string; bodyCode: string }) {
  useEffect(() => {
    const removeHead = injectSnippet(document.head, headCode, document.body);
    const removeBody = injectSnippet(document.body, bodyCode);
    return () => {
      removeHead();
      removeBody();
    };
  }, [headCode, bodyCode]);
  return null;
}

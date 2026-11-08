import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TurnstileWidgetProps } from "./Turnstile";

const SCRIPT_SELECTOR = 'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]';

function scriptElement(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
}

describe("TurnstileWidget", () => {
  let TurnstileWidget: (props: TurnstileWidgetProps) => JSX.Element;

  beforeEach(async () => {
    // Turnstile.tsx caches its script-load promise at module scope (by
    // design — real page loads should only ever inject the script once).
    // That's exactly what this file's second test needs to NOT carry
    // over from the first, so each test gets a genuinely fresh module.
    vi.resetModules();
    delete (window as { turnstile?: unknown }).turnstile;
    document.querySelectorAll(SCRIPT_SELECTOR).forEach((el) => el.remove());
    ({ TurnstileWidget } = await import("./Turnstile"));
  });

  afterEach(() => {
    delete (window as { turnstile?: unknown }).turnstile;
  });

  it("renders the widget once the script loads", async () => {
    const render_ = vi.fn().mockReturnValue("widget-1");
    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    window.turnstile = { render: render_, remove: vi.fn(), reset: vi.fn() };
    scriptElement()!.dispatchEvent(new Event("load"));
    await Promise.resolve();
    await Promise.resolve();

    expect(render_).toHaveBeenCalledTimes(1);
  });

  // PR #2 review: a cached, permanently-rejected load promise would leave
  // every enquiry form on the page unable to verify for the rest of the
  // session after one transient network failure. A fresh mount after a
  // failure must try a fresh <script> tag, not reuse the dead one.
  it("a failed script load doesn't permanently disable later widgets — a fresh mount retries with a fresh script", async () => {
    const onError = vi.fn();
    const first = render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} onError={onError} />);

    const failedScript = scriptElement();
    expect(failedScript).not.toBeNull();
    failedScript!.dispatchEvent(new Event("error"));
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(scriptElement()).toBeNull(); // the dead script is removed, not left dangling

    first.unmount();

    const render_ = vi.fn().mockReturnValue("widget-2");
    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    const retryScript = scriptElement();
    expect(retryScript).not.toBeNull();
    expect(retryScript).not.toBe(failedScript);

    window.turnstile = { render: render_, remove: vi.fn(), reset: vi.fn() };
    retryScript!.dispatchEvent(new Event("load"));
    await Promise.resolve();
    await Promise.resolve();

    expect(render_).toHaveBeenCalledTimes(1);
  });
});

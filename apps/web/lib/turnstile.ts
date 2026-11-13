type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset?: (widgetId?: string) => void;
  remove?: (widgetId?: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi; }
}

const scriptId = "cloudflare-turnstile-script";
let turnstileScript: Promise<void> | null = null;

export function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Turnstile is browser-only."));
  if (window.turnstile) return Promise.resolve();
  if (turnstileScript) return turnstileScript;
  turnstileScript = new Promise((resolve, reject) => {
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile failed to load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile failed to load."));
    document.head.appendChild(script);
  });
  turnstileScript.catch(() => {
    turnstileScript = null;
    document.getElementById(scriptId)?.remove();
  });
  return turnstileScript;
}

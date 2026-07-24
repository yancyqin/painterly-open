type TurnstileAction = "publish" | "report" | "auth";

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
}

interface TurnstileConfig {
  turnstile: { enabled: boolean; siteKey: string | null };
}

interface WidgetState {
  id: string;
  token: string;
  pending: Promise<string> | null;
  resolve: ((token: string) => void) | null;
  reject: ((error: Error) => void) | null;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export class TurnstileGate {
  private siteKey = "";
  private setupPromise: Promise<void> | null = null;
  private readonly widgets = new Map<TurnstileAction, WidgetState>();

  token(action: TurnstileAction): Promise<string> {
    return this.getToken(action);
  }

  reset(action: TurnstileAction): void {
    const widget = this.widgets.get(action);
    if (!widget || !window.turnstile) return;
    widget.token = "";
    widget.pending = null;
    widget.resolve = null;
    widget.reject = null;
    window.turnstile.reset(widget.id);
  }

  private async getToken(action: TurnstileAction): Promise<string> {
    await this.initialize();
    const widget = this.ensureWidget(action);
    if (widget.token) return widget.token;
    if (widget.pending) return widget.pending;

    widget.pending = new Promise<string>((resolve, reject) => {
      widget.resolve = resolve;
      widget.reject = reject;
    });
    window.turnstile!.execute(widget.id);
    return widget.pending;
  }

  private initialize(): Promise<void> {
    this.setupPromise ??= this.load();
    return this.setupPromise;
  }

  private async load(): Promise<void> {
    const response = await apiFetch("/api/config", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("The security check could not load. Try again in a moment.");
    const config = await response.json() as TurnstileConfig;
    if (!config.turnstile.enabled || !config.turnstile.siteKey) {
      throw new Error("The security check is temporarily unavailable.");
    }
    this.siteKey = config.turnstile.siteKey;
    await loadScript();
  }

  private ensureWidget(action: TurnstileAction): WidgetState {
    const existing = this.widgets.get(action);
    if (existing) return existing;
    const container = document.getElementById(`${action}-turnstile`);
    if (!container || !window.turnstile) throw new Error("The security check could not start.");

    const state: WidgetState = { id: "", token: "", pending: null, resolve: null, reject: null };
    this.widgets.set(action, state);
    state.id = window.turnstile.render(container, {
      sitekey: this.siteKey,
      action,
      theme: "dark",
      size: "flexible",
      appearance: "interaction-only",
      execution: "execute",
      callback: (token: string) => {
        state.token = token;
        state.resolve?.(token);
        state.pending = null;
        state.resolve = null;
        state.reject = null;
      },
      "error-callback": () => this.fail(action, "The security check did not finish. Please try again."),
      "expired-callback": () => this.fail(action, "The security check expired. Please try again."),
      "timeout-callback": () => this.fail(action, "The security check timed out. Please try again."),
    });
    return state;
  }

  private fail(action: TurnstileAction, message: string): void {
    const widget = this.widgets.get(action);
    if (!widget) return;
    widget.reject?.(new Error(message));
    widget.pending = null;
    widget.resolve = null;
    widget.reject = null;
    widget.token = "";
    window.turnstile?.reset(widget.id);
  }
}

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    const timeout = window.setTimeout(() => reject(new Error("The security check took too long to load.")), 12_000);
    const finish = (): void => {
      window.clearTimeout(timeout);
      window.turnstile ? resolve() : reject(new Error("The security check could not load."));
    };
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("The security check could not load."));
    }, { once: true });
    if (!existing) {
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
  });
}
import { apiFetch } from "./api";

import english from "./en";
import type { Catalog, MessageKey } from "./types";

export const SUPPORTED_LOCALES = [
  "en", "zh-Hans", "zh-Hant", "es", "fr", "de", "pt-BR", "ja",
  "ko", "it", "ru", "ar", "hi", "id", "tr", "th",
] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];
export type { MessageKey };

const LOCALE_LABELS: Readonly<Record<SupportedLocale, string>> = {
  en: "English",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  "pt-BR": "Português",
  ja: "日本語",
  ko: "한국어",
  it: "Italiano",
  ru: "Русский",
  ar: "العربية",
  hi: "हिन्दी",
  id: "Bahasa Indonesia",
  tr: "Türkçe",
  th: "ไทย",
};

const loaders: Readonly<Record<Exclude<SupportedLocale, "en">, () => Promise<{ default: Catalog }>>> = {
  "zh-Hans": () => import("./zh-Hans"),
  "zh-Hant": () => import("./zh-Hant"),
  es: () => import("./es"),
  fr: () => import("./fr"),
  de: () => import("./de"),
  "pt-BR": () => import("./pt-BR"),
  ja: () => import("./ja"),
  ko: () => import("./ko"),
  it: () => import("./it"),
  ru: () => import("./ru"),
  ar: () => import("./ar"),
  hi: () => import("./hi"),
  id: () => import("./id"),
  tr: () => import("./tr"),
  th: () => import("./th"),
};

let activeLocale: SupportedLocale = "en";
let activeCatalog: Catalog = english;

export async function initializeI18n(root: ParentNode = document): Promise<void> {
  activeLocale = resolveLocale(new URLSearchParams(location.search).get("lang"));
  activeCatalog = await loadCatalog(activeLocale);
  applyLocale(root);
  populateLocaleSelects(root);
}

export function t(key: MessageKey, values: Readonly<Record<string, string | number>> = {}): string {
  return activeCatalog[key].replace(/\{([A-Za-z0-9_]+)\}/gu, (_match, name: string) => String(values[name] ?? `{${name}}`));
}

export function locale(): SupportedLocale {
  return activeLocale;
}

async function setLocale(next: SupportedLocale, root: ParentNode): Promise<void> {
  activeLocale = next;
  activeCatalog = await loadCatalog(next);
  localStorage.setItem("pc:locale", next);
  const url = new URL(location.href);
  url.searchParams.set("lang", next);
  history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  applyLocale(root);
  root.querySelectorAll<HTMLSelectElement>("[data-locale-select]").forEach(select => {
    select.value = next;
    select.setAttribute("aria-label", t("ui.language"));
  });
  document.dispatchEvent(new CustomEvent("pc:localechange", { detail: { locale: next } }));
}

function applyLocale(root: ParentNode): void {
  document.documentElement.lang = activeLocale;
  document.documentElement.dir = activeLocale === "ar" ? "rtl" : "ltr";
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach(node => {
    const key = node.dataset.i18n as MessageKey | undefined;
    if (key && key in activeCatalog) node.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach(node => {
    const key = node.dataset.i18nAriaLabel as MessageKey | undefined;
    if (key && key in activeCatalog) node.setAttribute("aria-label", t(key));
  });
  root.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]").forEach(node => {
    const key = node.dataset.i18nPlaceholder as MessageKey | undefined;
    if (key && key in activeCatalog) node.placeholder = t(key);
  });
}

function populateLocaleSelects(root: ParentNode): void {
  root.querySelectorAll<HTMLSelectElement>("[data-locale-select]").forEach(select => {
    select.replaceChildren(...SUPPORTED_LOCALES.map(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = LOCALE_LABELS[value];
      return option;
    }));
    select.value = activeLocale;
    select.setAttribute("aria-label", t("ui.language"));
    select.addEventListener("change", () => void setLocale(select.value as SupportedLocale, root));
  });
}

function loadCatalog(value: SupportedLocale): Promise<Catalog> {
  return value === "en" ? Promise.resolve(english) : loaders[value]().then(module => module.default);
}

function resolveLocale(requested: string | null): SupportedLocale {
  const candidates = [requested, localStorage.getItem("pc:locale"), ...navigator.languages];
  for (const value of candidates) {
    const normalized = normalizeLocale(value);
    if (normalized) return normalized;
  }
  return "en";
}

function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
  if (!value) return null;
  const tag = value.trim().replace("_", "-").toLowerCase();
  if (tag === "zh-tw" || tag === "zh-hk" || tag === "zh-hant") return "zh-Hant";
  if (tag === "zh" || tag === "zh-cn" || tag === "zh-sg" || tag === "zh-hans") return "zh-Hans";
  if (tag === "pt" || tag.startsWith("pt-")) return "pt-BR";
  return SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === tag || locale.toLowerCase().split("-")[0] === tag.split("-")[0]) ?? null;
}

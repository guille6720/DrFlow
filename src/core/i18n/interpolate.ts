import type { MessageParams } from "@/core/i18n/types";

/** Replaces `{{key}}` placeholders in a template string. */
export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ""));
}

/** Resolves a message value (static string or factory). */
export function resolveMessage(
  value: string | ((params: MessageParams) => string),
  params?: MessageParams
): string {
  return typeof value === "function" ? value(params ?? {}) : value;
}

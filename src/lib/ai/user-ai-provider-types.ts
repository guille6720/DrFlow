export type UserAiProviderId = "openai" | "anthropic" | "openai_compatible" | "gemini";

export type UserAiConnectionPublic = {
  provider: UserAiProviderId;
  model: string;
  label: string | null;
  baseUrl: string | null;
  keyHint: string;
  updatedAt: string;
};

export type UserAiCredentials = {
  provider: UserAiProviderId;
  apiKey: string;
  baseUrl: string | null;
  model: string;
};

export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const USER_AI_PROVIDER_OPTIONS: Array<{
  id: UserAiProviderId;
  label: string;
  description: string;
  defaultModel: string;
  defaultBaseUrl: string | null;
  baseUrlRequired?: boolean;
  hideBaseUrl?: boolean;
  apiKeyPlaceholder?: string;
  apiKeyHelpUrl?: string;
}> = [
  {
    id: "openai",
    label: "OpenAI",
    description: "ChatGPT API (GPT-4o, GPT-4o mini, etc.)",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    hideBaseUrl: true,
    apiKeyPlaceholder: "sk-…",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude (Haiku, Sonnet, Opus)",
    defaultModel: "claude-3-5-haiku-latest",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    apiKeyPlaceholder: "sk-ant-…",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    description: "Gemini (Flash, Pro) vía Google AI Studio",
    defaultModel: "gemini-2.0-flash",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    hideBaseUrl: true,
    apiKeyPlaceholder: "AIza…",
    apiKeyHelpUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "openai_compatible",
    label: "Compatible OpenAI",
    description: "Ollama, LM Studio, Azure OpenAI u otro endpoint /chat/completions",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: null,
    baseUrlRequired: true,
    apiKeyPlaceholder: "sk-…",
  },
];

export function maskUserAiApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function getDefaultModelForProvider(provider: UserAiProviderId): string {
  return USER_AI_PROVIDER_OPTIONS.find((p) => p.id === provider)?.defaultModel ?? "gpt-4o-mini";
}

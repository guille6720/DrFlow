import "server-only";

export type VertexGeminiConfig = {
  project: string;
  location: string;
  model: string;
  serviceAccountJson: string;
};

export function getVertexGeminiConfig(
  env: NodeJS.ProcessEnv = process.env
): VertexGeminiConfig | null {
  const project = env.VERTEX_AI_PROJECT?.trim() || env.GOOGLE_CLOUD_PROJECT?.trim();
  const serviceAccountJson =
    env.VERTEX_AI_SERVICE_ACCOUNT_JSON?.trim() || env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!project || !serviceAccountJson) return null;

  return {
    project,
    location: env.VERTEX_AI_LOCATION?.trim() || "us-central1",
    model: env.VERTEX_AI_MODEL?.trim() || "gemini-1.5-flash",
    serviceAccountJson,
  };
}

export function isVertexGeminiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getVertexGeminiConfig(env) !== null;
}

export function getGeminiApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env.GEMINI_API_KEY?.trim() || env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  return key || null;
}

export function isClinicGeminiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return isVertexGeminiConfigured(env) || Boolean(getGeminiApiKey(env));
}

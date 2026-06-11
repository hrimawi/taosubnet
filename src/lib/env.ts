/** Server-side environment access with helpful failures instead of crashes. */

export class ConfigError extends Error {
  constructor(varName: string, hint: string) {
    super(`Missing environment variable ${varName}. ${hint}`);
    this.name = "ConfigError";
  }
}

export function requireEnv(name: string, hint = "See .env.example."): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new ConfigError(name, hint);
  return v;
}

export function optionalEnv(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : null;
}

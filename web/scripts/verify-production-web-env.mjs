import { pathToFileURL } from "node:url";

const REQUIRED_PUBLIC_ENV = [
  "VITE_API_BASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
];

function decodeJwtPayload(value) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

function validateHttpsOrigin(name, value, errors) {
  let url;
  try {
    url = new URL(value);
  } catch {
    errors.push(`${name}: must be a valid HTTPS origin`);
    return;
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    errors.push(`${name}: must be an HTTPS origin without credentials, path, query, or fragment`);
  }
}

function validateSupabasePublishableKey(value, errors) {
  if (value.startsWith("sb_secret_")) {
    errors.push("VITE_SUPABASE_PUBLISHABLE_KEY: secret keys are not allowed");
    return;
  }

  if (value.startsWith("sb_publishable_") && value.length > "sb_publishable_".length) return;

  const payload = decodeJwtPayload(value);
  if (payload?.role === "service_role") {
    errors.push("VITE_SUPABASE_PUBLISHABLE_KEY: service_role keys are not allowed");
    return;
  }
  if (payload?.role === "anon") return;

  errors.push("VITE_SUPABASE_PUBLISHABLE_KEY: expected sb_publishable_... or a legacy anon JWT");
}

export function validateProductionWebEnv(env = process.env) {
  if (env.WORKERS_CI !== "1") return { enforced: false, errors: [] };

  const errors = [];
  for (const name of REQUIRED_PUBLIC_ENV) {
    if (!env[name]?.trim()) errors.push(`${name}: missing required public build variable`);
  }

  if (env.VITE_API_BASE_URL?.trim()) {
    validateHttpsOrigin("VITE_API_BASE_URL", env.VITE_API_BASE_URL.trim(), errors);
  }
  if (env.VITE_SUPABASE_URL?.trim()) {
    validateHttpsOrigin("VITE_SUPABASE_URL", env.VITE_SUPABASE_URL.trim(), errors);
  }
  if (env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    validateSupabasePublishableKey(env.VITE_SUPABASE_PUBLISHABLE_KEY.trim(), errors);
  }

  return { enforced: true, errors };
}

function main() {
  const result = validateProductionWebEnv(process.env);
  if (!result.enforced) {
    console.log("production web env verification skipped outside Workers Builds");
    return;
  }
  if (result.errors.length) {
    console.error("production web env verification failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log("production web env verification passed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

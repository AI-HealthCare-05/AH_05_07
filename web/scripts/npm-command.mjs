import { execFileSync, spawn } from "node:child_process";

const SAFE_WINDOWS_TOKEN = /^[A-Za-z0-9_./\\:@%+=,-]+$/;

function validateArgs(args) {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new TypeError("npm args must be an array of strings");
  }
}

function windowsCommand(args) {
  const tokens = ["npm.cmd", ...args];
  for (const token of tokens) {
    if (!SAFE_WINDOWS_TOKEN.test(token)) {
      throw new TypeError(`unsafe Windows npm token: ${token}`);
    }
  }
  return tokens.join(" ");
}

export function resolveNpmInvocation(
  args,
  {
    platform = process.platform,
    comspec = process.env.ComSpec || "cmd.exe",
  } = {},
) {
  validateArgs(args);

  if (platform !== "win32") {
    return { file: "npm", args: [...args] };
  }

  return {
    file: comspec,
    args: ["/d", "/s", "/c", windowsCommand(args)],
  };
}

export function runNpmSync(args, options = {}) {
  const command = resolveNpmInvocation(args);
  return execFileSync(command.file, command.args, options);
}

export function spawnNpm(args, options = {}) {
  const command = resolveNpmInvocation(args);
  return spawn(command.file, command.args, options);
}

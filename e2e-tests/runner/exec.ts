import { execa, type TemplateExpression } from "execa";
import { createInterface } from "node:readline";
import { type Readable } from "node:stream";

const verbose =
  process.argv.includes("--verbose") || process.argv.includes("-v");

type ExecOptions = { env?: NodeJS.ProcessEnv; label?: string };

export function run(cwd: string, { env, label }: ExecOptions = {}) {
  return async (
    command: TemplateStringsArray,
    ...args: readonly TemplateExpression[]
  ): Promise<boolean> => {
    const subprocess = execa({
      cwd,
      env: { ...process.env, ...env },
      reject: false,
    })(command, ...args);

    if (verbose) {
      const prefix = label ? `[${label}] ` : "";
      prefixLines(subprocess.stdout, process.stdout, prefix);
      prefixLines(subprocess.stderr, process.stderr, prefix);
    }

    const result = await subprocess;
    const ok = result.exitCode === 0;
    if (!ok && !verbose) {
      printFailure(label, String(result.stdout), String(result.stderr));
    }
    return ok;
  };
}

// Runs a command and returns its trimmed stdout, or "" if it fails.
export function capture(cwd: string) {
  return async (
    command: TemplateStringsArray,
    ...args: readonly TemplateExpression[]
  ): Promise<string> => {
    const result = await execa({ cwd, reject: false })(command, ...args);
    return result.exitCode === 0 ? String(result.stdout).trim() : "";
  };
}

export function runOrThrow(cwd: string, opts: ExecOptions = {}) {
  return async (
    command: TemplateStringsArray,
    ...args: readonly TemplateExpression[]
  ): Promise<void> => {
    if (!(await run(cwd, opts)(command, ...args))) {
      const text = String.raw(command, ...args)
        .replace(/\s+/g, " ")
        .trim();
      throw new Error(`${text} failed`);
    }
  };
}

function prefixLines(
  input: Readable | null,
  output: NodeJS.WriteStream,
  prefix: string,
): void {
  if (!input) return;
  const lines = createInterface({ input });
  lines.on("line", (line) => output.write(`${prefix}${line}\n`));
}

function printFailure(
  label: string | undefined,
  stdout: string,
  stderr: string,
): void {
  if (label) process.stderr.write(`\n──── output: ${label} ────\n`);
  if (stdout) process.stderr.write(stdout);
  if (stderr) process.stderr.write(stderr);
  if (label) process.stderr.write(`──── end: ${label} ────\n\n`);
}

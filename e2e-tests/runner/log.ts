const COLOR = {
  green: "\x1b[1;32m",
  red: "\x1b[1;31m",
  reset: "\x1b[0m",
};

const TICK = `${COLOR.green}✓${COLOR.reset}`;
const CROSS = `${COLOR.red}✗${COLOR.reset}`;

export type Logger = {
  info(msg: string): void;
  ok(msg: string): void;
  fail(msg: string): void;
};

function makeLogger(label: string | null): Logger {
  const tag = label ? `[${label}] ` : "";
  return {
    info: (msg) => console.log(`${stamp()}${tag}${msg}`),
    ok: (msg) => console.log(`${stamp()}${TICK} ${tag}${msg}`),
    fail: (msg) => console.log(`${stamp()}${CROSS} ${tag}${msg}`),
  };
}

// Unattended runs (the nightly) set LOG_TIMESTAMPS so every line is timestamped;
// that is what tells you where a long run stalled. Interactive runs leave it
// unset to keep output clean.
function stamp(): string {
  if (!process.env.LOG_TIMESTAMPS) return "";
  return `${new Date().toTimeString().slice(0, 8)} `;
}

const root = makeLogger(null);

export const log = {
  ...root,

  scope(label: string): Logger {
    return makeLogger(label);
  },

  fatal(msg: string): never {
    console.error(`${stamp()}${msg}`);
    process.exit(1);
  },
};

export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSec = Math.round(ms / 1000);
  return `${Math.floor(totalSec / 60)}m ${totalSec % 60}s`;
}

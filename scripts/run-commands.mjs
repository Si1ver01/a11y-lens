import { spawn } from 'node:child_process';
import process from 'node:process';

const LEVEL_RANK = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40, SILENT: 100 };
const FORBIDDEN_ARGUMENT = /(?:token|secret|password|authorization|cookie|api[-_]?key)/i;

function resolveLevel(value) {
  const level = value?.toUpperCase();
  return level && level in LEVEL_RANK ? level : 'INFO';
}

function sanitizeArguments(args) {
  return args.map((argument) => (FORBIDDEN_ARGUMENT.test(argument) ? '[REDACTED]' : argument));
}

function createLogger(level) {
  const threshold = LEVEL_RANK[level];
  return (eventLevel, event, context = {}) => {
    if (LEVEL_RANK[eventLevel] < threshold) return;
    const line = `${JSON.stringify({ level: eventLevel, scope: 'command-runner', event, ...context })}\n`;
    (eventLevel === 'ERROR' ? process.stderr : process.stdout).write(line);
  };
}

function parseCommands(args) {
  const groups = [];
  let current = [];
  for (const argument of args) {
    if (argument === ':::') {
      if (current.length === 0) throw new Error('Empty command group.');
      groups.push(current);
      current = [];
    } else {
      current.push(argument);
    }
  }
  if (current.length > 0) groups.push(current);
  if (groups.length === 0) throw new Error('At least one command is required.');
  return groups;
}

function runCommand(command, args, log) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    log('DEBUG', 'command-started', { command, args: sanitizeArguments(args) });
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.once('error', (error) => reject(error));
    child.once('exit', (code, signal) => {
      const context = { command, code, signal, durationMs: Date.now() - startedAt };
      if (code === 0) {
        log('DEBUG', 'command-completed', context);
        resolve();
      } else {
        log('ERROR', 'command-failed', context);
        reject(new Error(`Command failed with exit code ${String(code)}.`));
      }
    });
  });
}

async function main() {
  const [, , stage, ...rawArguments] = process.argv;
  if (!stage) throw new Error('A stage name is required.');
  const level = resolveLevel(process.env.LOG_LEVEL);
  const log = createLogger(level);
  const commands = parseCommands(rawArguments);
  const startedAt = Date.now();
  log('INFO', 'stage-started', {
    stage,
    commandCount: commands.length,
    nodeVersion: process.version,
  });
  for (const [command, ...args] of commands) {
    if (!command) throw new Error('Command name is required.');
    await runCommand(command, args, log);
  }
  log('INFO', 'stage-completed', { stage, durationMs: Date.now() - startedAt });
}

main().catch((error) => {
  const log = createLogger(resolveLevel(process.env.LOG_LEVEL));
  log('ERROR', 'stage-failed', {
    errorName: error instanceof Error ? error.name : 'UnknownError',
  });
  process.exitCode = 1;
});

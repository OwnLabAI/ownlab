import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createRuntimeLogWriter } from './runtime-log';

export interface ManagedProcessOptions {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  logFilePath?: string;
}

export class ManagedProcess {
  private childProcess: ChildProcessWithoutNullStreams | null = null;
  private readonly recentLines: string[] = [];
  private readonly logWriter;

  constructor(private readonly options: ManagedProcessOptions) {
    this.logWriter = options.logFilePath
      ? createRuntimeLogWriter(options.logFilePath)
      : null;
  }

  start(): void {
    if (this.childProcess) {
      return;
    }

    this.childProcess = spawn(this.options.command, this.options.args, {
      cwd: this.options.cwd,
      env: this.options.env,
      stdio: 'pipe',
      windowsHide: true,
    });

    this.logWriter?.writeLine(
      `--- ${new Date().toISOString()} start ${this.options.name}: ${this.options.command} ${this.options.args.join(' ')} ---`,
    );

    this.childProcess.stdout.on('data', (chunk) => {
      this.handleOutput('stdout', chunk);
    });

    this.childProcess.stderr.on('data', (chunk) => {
      this.handleOutput('stderr', chunk);
    });

    this.childProcess.once('exit', (code, signal) => {
      this.logWriter?.writeLine(
        `--- ${new Date().toISOString()} exit ${this.options.name}: code=${code ?? 'null'} signal=${signal ?? 'null'} ---`,
      );

      if (code === 0 || signal === 'SIGTERM') {
        return;
      }
      console.error(`[${this.options.name}] exited unexpectedly`, { code, signal });
    });
  }

  async stop(): Promise<void> {
    const childProcess = this.childProcess;
    this.childProcess = null;

    if (!childProcess || childProcess.killed) {
      return;
    }

    await new Promise<void>((resolve) => {
      childProcess.once('exit', () => resolve());
      childProcess.kill('SIGTERM');
      setTimeout(() => {
        if (!childProcess.killed) {
          childProcess.kill('SIGKILL');
        }
      }, 5_000);
    });
  }

  getRecentOutput(limit = 40): string {
    return this.recentLines.slice(-limit).join('\n');
  }

  getLogFilePath(): string | null {
    return this.logWriter?.path ?? null;
  }

  private handleOutput(stream: 'stdout' | 'stderr', chunk: Buffer): void {
    const text = chunk.toString();
    const taggedText = `[${this.options.name}] ${text}`;

    if (stream === 'stdout') {
      process.stdout.write(taggedText);
    } else {
      process.stderr.write(taggedText);
    }

    this.logWriter?.write(taggedText);

    for (const line of text.split(/\r?\n/)) {
      const normalizedLine = line.trim();
      if (!normalizedLine) {
        continue;
      }
      this.recentLines.push(normalizedLine);
      if (this.recentLines.length > 400) {
        this.recentLines.splice(0, this.recentLines.length - 400);
      }
    }
  }
}

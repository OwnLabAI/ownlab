import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export function createRuntimeLogWriter(logFilePath: string) {
  mkdirSync(path.dirname(logFilePath), { recursive: true });

  return {
    write(chunk: string) {
      appendFileSync(logFilePath, chunk, 'utf8');
    },
    writeLine(line: string) {
      appendFileSync(logFilePath, `${line}\n`, 'utf8');
    },
    path: logFilePath,
  };
}

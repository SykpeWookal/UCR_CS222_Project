import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function tidy(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Extract plain text from an uploaded PDF buffer. Prefer poppler's pdftotext
// (fast, no Node PDF lib needed); fall back to pdf-parse if it is unavailable.
export async function extractPdfText(buffer) {
  if (!buffer || !buffer.length) {
    throw new Error('Empty PDF buffer.');
  }

  const dir = await mkdtemp(path.join(tmpdir(), 'pdfup-'));
  const file = path.join(dir, 'input.pdf');
  try {
    await writeFile(file, buffer);
    try {
      const { stdout } = await execFileAsync('pdftotext', ['-q', file, '-'], {
        maxBuffer: 1024 * 1024 * 32,
        timeout: 30000
      });
      return tidy(stdout);
    } catch (popplerError) {
      if (popplerError?.code !== 'ENOENT') {
        throw popplerError;
      }
      // pdftotext not installed — fall back to pdf-parse.
      const mod = await import('pdf-parse');
      const pdfParse = mod.default || mod;
      const data = await pdfParse(buffer);
      return tidy(data.text);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

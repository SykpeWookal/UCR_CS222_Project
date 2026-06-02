import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Engines are tried in this order. Tectonic auto-downloads packages; the
// texlive engines (latexmk/pdflatex) work offline when texlive is installed.
const ENGINE_CANDIDATES = ['tectonic', 'latexmk', 'pdflatex', 'xelatex'];

let cachedEngine;

async function resolveEngine() {
  if (process.env.LATEX_ENGINE) {
    return process.env.LATEX_ENGINE;
  }
  if (cachedEngine !== undefined) {
    return cachedEngine;
  }
  for (const name of ENGINE_CANDIDATES) {
    try {
      await execFileAsync('which', [name]);
      cachedEngine = name;
      return name;
    } catch {
      // not found, try the next candidate
    }
  }
  cachedEngine = null;
  return null;
}

function engineRuns(engine, workdir, texPath) {
  const runOptions = { cwd: workdir, timeout: 90000, maxBuffer: 1024 * 1024 * 16 };

  if (engine === 'tectonic') {
    return [['tectonic', ['--outdir', workdir, texPath], runOptions]];
  }

  if (engine === 'latexmk') {
    // -f forces latexmk to finish and emit a PDF even if there are recoverable
    // errors (e.g. undefined citations or a stray math symbol the LLM emitted).
    return [
      [
        'latexmk',
        ['-pdf', '-f', '-interaction=nonstopmode', `-outdir=${workdir}`, texPath],
        runOptions
      ]
    ];
  }

  // pdflatex / xelatex: run twice so hyperref and any references settle.
  // No -halt-on-error: nonstopmode recovers from minor issues and still emits a PDF.
  const args = ['-interaction=nonstopmode', `-output-directory=${workdir}`, texPath];
  return [
    [engine, args, runOptions],
    [engine, args, runOptions]
  ];
}

export async function proposalLatexToPdf(latex, title = 'proposal') {
  const source = String(latex || '').trim();

  if (!source) {
    throw new Error('LaTeX source is empty.');
  }

  const engine = await resolveEngine();

  if (!engine) {
    throw new Error(
      'No LaTeX engine found. Install tectonic (https://tectonic-typesetting.github.io/) or a TeX distribution that provides pdflatex/latexmk, or set the LATEX_ENGINE environment variable.'
    );
  }

  const workdir = await mkdtemp(path.join(tmpdir(), 'proposal-tex-'));
  const texPath = path.join(workdir, 'proposal.tex');
  const pdfPath = path.join(workdir, 'proposal.pdf');
  const logPath = path.join(workdir, 'proposal.log');

  try {
    await writeFile(texPath, sanitizeLatexForExport(ensureCompleteLatexDocument(source, title)), 'utf8');

    let compileError;
    try {
      for (const [cmd, args, options] of engineRuns(engine, workdir, texPath)) {
        await execFileAsync(cmd, args, options);
      }
    } catch (error) {
      // Some engines exit non-zero even when a usable PDF was produced; we
      // check for the PDF below before deciding this is a hard failure.
      compileError = error;
    }

    const pdf = await readFile(pdfPath).catch(() => null);

    if (pdf && pdf.length) {
      return pdf;
    }

    const logTail = await readFile(logPath, 'utf8')
      .then((text) => text.split('\n').slice(-25).join('\n'))
      .catch(() => '');
    const detail = logTail || (compileError instanceof Error ? compileError.message : 'Unknown compile error.');
    throw new Error(`PDF compilation with "${engine}" failed.\n${detail}`);
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

function sanitizeLatexForExport(source) {
  return protectMathSymbols(replaceExternalImageIncludes(source));
}

// LLMs frequently emit math-only macros (e.g. \rightarrow) in plain text, which
// makes pdflatex throw "Missing $ inserted". Wrapping each in \ensuremath makes
// it valid in BOTH text and math mode, and double-wrapping is a harmless no-op.
const MATH_MACROS = [
  'rightarrow', 'leftarrow', 'leftrightarrow', 'Rightarrow', 'Leftarrow', 'Leftrightarrow',
  'longrightarrow', 'longleftarrow', 'mapsto', 'to', 'gets',
  'times', 'cdot', 'div', 'pm', 'mp', 'ast', 'star',
  'leq', 'geq', 'neq', 'approx', 'equiv', 'sim', 'simeq', 'propto', 'll', 'gg',
  'infty', 'partial', 'nabla', 'forall', 'exists', 'in', 'notin',
  'subset', 'subseteq', 'supset', 'supseteq', 'cup', 'cap', 'emptyset',
  'sum', 'prod', 'int', 'sqrt',
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta',
  'kappa', 'lambda', 'mu', 'nu', 'xi', 'rho', 'sigma', 'tau', 'phi', 'varphi', 'chi', 'psi', 'omega',
  'Delta', 'Gamma', 'Lambda', 'Sigma', 'Phi', 'Omega', 'Theta', 'Pi',
  'cdots', 'ldots', 'dots', 'vdots', 'ddots'
];

function protectMathSymbols(source) {
  let output = String(source || '');
  for (const macro of MATH_MACROS) {
    // Match \macro not followed by a letter, and not already directly inside an
    // \ensuremath{ ... } wrapper we just created.
    const pattern = new RegExp(`\\\\${macro}(?![a-zA-Z])`, 'g');
    output = output.replace(pattern, `\\ensuremath{\\${macro}}`);
  }
  // Collapse accidental double wrapping like \ensuremath{\ensuremath{\to}}.
  output = output.replace(/\\ensuremath\{\\ensuremath\{(\\[a-zA-Z]+)\}\}/g, '\\ensuremath{$1}');
  return output;
}

function replaceExternalImageIncludes(source) {
  return String(source || '').replace(
    /\\includegraphics(?:\s*\[[^\]]*\])?\s*\{([^{}]+)\}/g,
    (_, filename) => imagePlaceholder(filename)
  );
}

function imagePlaceholder(filename) {
  return String.raw`\begin{center}
\fbox{\begin{minipage}{0.86\linewidth}
\centering
\textbf{Workflow diagram}\\[0.45em]
Rough idea $\rightarrow$ structured state $\rightarrow$ student decisions $\rightarrow$ proposal draft $\rightarrow$ compliance review $\rightarrow$ revised PDF\\[0.45em]
\footnotesize External image asset \texttt{${escapeLatex(filename)}} was not provided, so the exporter rendered this LaTeX-native placeholder.
\end{minipage}}
\end{center}`;
}

function ensureCompleteLatexDocument(source, title) {
  if (/\\documentclass\b/.test(source) && /\\begin\{document\}/.test(source)) {
    return normalizeCompleteLatexDocument(source);
  }

  return String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\setlist{nosep}
\title{${escapeLatex(title)}}
\author{}
\date{}
\begin{document}
\maketitle
${source}
\end{document}
`;
}

function normalizeCompleteLatexDocument(source) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  const beginIndex = lines.findIndex((line) => /\\begin\{document\}/.test(line));
  const endIndex = findLastIndex(lines, (line) => /\\end\{document\}/.test(line));

  if (beginIndex === -1) {
    return source;
  }

  const preambleLines = lines.slice(0, beginIndex);
  const bodyLines = lines.slice(beginIndex + 1, endIndex === -1 ? lines.length : endIndex);
  const documentClass = preambleLines.find((line) => /\\documentclass\b/.test(line)) || '\\documentclass[11pt]{article}';
  const preamble = [];
  const movedPreamble = [];

  preambleLines.forEach((line) => {
    if (/\\documentclass\b/.test(line)) return;
    if (/\\begin\{document\}|\\end\{document\}/.test(line)) return;
    preamble.push(line);
  });

  const cleanBody = bodyLines.filter((line) => {
    if (/\\documentclass\b|\\begin\{document\}|\\end\{document\}/.test(line)) return false;
    if (/^\s*\\(?:usepackage|geometry)\b/.test(line)) {
      movedPreamble.push(line);
      return false;
    }
    return true;
  });

  const normalizedPreamble = ensureDefaultPreamble([documentClass, ...preamble, ...movedPreamble]);

  return `${dedupeLines(normalizedPreamble).join('\n')}\n\\begin{document}\n${cleanBody.join('\n').trim()}\n\\end{document}\n`;
}

function ensureDefaultPreamble(lines) {
  const source = lines.join('\n');
  const next = [...lines];

  if (!/\\usepackage(?:\[[^\]]*\])?\{geometry\}/.test(source)) {
    next.push('\\usepackage[margin=1in]{geometry}');
  }

  if (!/\\usepackage(?:\[[^\]]*\])?\{hyperref\}/.test(source)) {
    next.push('\\usepackage[hidelinks]{hyperref}');
  }

  if (!/\\usepackage(?:\[[^\]]*\])?\{enumitem\}/.test(source)) {
    next.push('\\usepackage{enumitem}');
  }

  return next;
}

function dedupeLines(lines) {
  const seen = new Set();

  return lines.filter((line) => {
    const key = line.trim();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findLastIndex(items, predicate) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index], index)) return index;
  }

  return -1;
}

function escapeLatex(value) {
  return String(value || '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

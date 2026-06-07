import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { proposalLatexToPdf } from './pdfExport.js';
import { extractPdfText } from './pdfText.js';
import {
  answerAgentQuestion,
  generateProposal,
  recommendReferences,
  reviseProposal,
  startAgentSession
} from './proposalGenerator.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  const ready = Boolean(process.env.LLM_API_KEY && process.env.LLM_API_URL);
  response.json({
    ok: true,
    mode: ready ? 'api-ready' : 'local-fallback',
    provider: ready ? process.env.LLM_PROVIDER || 'openai-compatible' : 'template',
    model: ready ? process.env.LLM_MODEL || '' : ''
  });
});

app.post('/api/agent/start', async (request, response) => {
  try {
    const payload = request.body || {};

    if (!String(payload.topic || '').trim()) {
      response.status(400).json({ error: 'Topic is required.' });
      return;
    }

    response.json(await startAgentSession(payload));
  } catch (error) {
    response.status(500).json({
      error: 'Agent start failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/agent/answer', async (request, response) => {
  try {
    const payload = request.body || {};

    if (!String(payload.answer || '').trim()) {
      response.status(400).json({ error: 'Answer is required.' });
      return;
    }

    response.json(await answerAgentQuestion(payload));
  } catch (error) {
    response.status(500).json({
      error: 'Answer integration failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/proposal', async (request, response) => {
  try {
    const payload = request.body || {};

    if (!String(payload.topic || '').trim()) {
      response.status(400).json({ error: 'Topic is required.' });
      return;
    }

    const result = await generateProposal(payload);
    response.json(result);
  } catch (error) {
    response.status(500).json({
      error: 'Proposal generation failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/agent/references', async (request, response) => {
  try {
    const payload = request.body || {};

    if (!String(payload.topic || payload.title || '').trim()) {
      response.status(400).json({ error: 'Topic is required.' });
      return;
    }

    response.json(await recommendReferences(payload));
  } catch (error) {
    response.status(500).json({
      error: 'Reference recommendation failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/references/upload', upload.single('file'), async (request, response) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: 'A PDF file is required.' });
      return;
    }

    const text = await extractPdfText(request.file.buffer);
    response.json({
      filename: request.file.originalname,
      chars: text.length,
      text: text.slice(0, 8000)
    });
  } catch (error) {
    response.status(500).json({
      error: 'PDF parsing failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/agent/revise', async (request, response) => {
  try {
    const payload = request.body || {};

    if (!String(payload.topic || payload.title || '').trim()) {
      response.status(400).json({ error: 'Topic is required.' });
      return;
    }

    const result = await reviseProposal(payload);
    response.json(result);
  } catch (error) {
    response.status(500).json({
      error: 'Proposal revision failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/export/pdf', async (request, response) => {
  try {
    const payload = request.body || {};
    const latex = String(payload.proposalLatex || '').trim();

    if (!latex) {
      response.status(400).json({ error: 'proposalLatex is required.' });
      return;
    }

    const title = String(payload.title || 'proposal').trim();
    const pdf = await proposalLatexToPdf(latex, title);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename="proposal.pdf"');
    response.send(pdf);
  } catch (error) {
    response.status(500).json({
      error: 'PDF export failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

// Serve the built frontend (npm run build) so a single port can host both the
// app and the API. This is the simplest path for a public tunnel / deployment.
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((request, response, next) => {
    if (request.method === 'GET' && !request.path.startsWith('/api')) {
      response.sendFile(path.join(distDir, 'index.html'));
      return;
    }
    next();
  });
}

app.listen(port, host, () => {
  console.log(`Proposal API listening on http://${host}:${port} (serving frontend: ${existsSync(distDir)})`);
});

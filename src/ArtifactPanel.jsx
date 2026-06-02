import { FileText } from 'lucide-react';

export const ARTIFACT_TABS = [
  ['pdf', 'PDF'],
  ['latex', 'LaTeX'],
  ['matrix', 'Matrix'],
  ['review', 'Review'],
  ['transcript', 'Transcript'],
  ['evidence', 'Evidence']
];

export function EmptyState({ text, compact = false }) {
  return (
    <div className={compact ? 'empty-state compact' : 'empty-state'}>
      <FileText size={compact ? 24 : 32} aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

export function ArtifactContent({ agent }) {
  const { activeTab, result, pdfUrl, pdfError, transcripts, versions, downloadEvidence } = agent;

  if (!result) {
    return <EmptyState text="Proposal artifacts appear after you generate a draft." />;
  }

  if (activeTab === 'pdf') {
    if (pdfUrl) {
      return <iframe className="pdf-preview" src={pdfUrl} title="Compiled proposal PDF" />;
    }
    return (
      <EmptyState
        text={
          pdfError
            ? `PDF preview unavailable (${pdfError}). The LaTeX source is ready in the LaTeX tab — install tectonic to compile PDFs locally.`
            : 'PDF preview is rendering.'
        }
      />
    );
  }

  if (activeTab === 'latex') {
    return <pre className="proposal-output">{result.proposalLatex}</pre>;
  }

  if (activeTab === 'matrix') {
    return (
      <div className="matrix-wrap">
        <table>
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Status</th>
              <th>Evidence</th>
              <th>Fix</th>
            </tr>
          </thead>
          <tbody>
            {(result.complianceMatrix || []).map((row, index) => (
              <tr key={`${row.requirement}-${index}`}>
                <td>{row.requirement}</td>
                <td>
                  <span className={/^covered$/i.test(row.status) ? 'badge covered' : 'badge needs-work'}>
                    {row.status}
                  </span>
                </td>
                <td>{row.evidence}</td>
                <td>{row.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (activeTab === 'review') {
    const latest = versions[versions.length - 1];
    return (
      <div className="review-wrap">
        {latest?.changelog?.length ? (
          <div className="changelog-block">
            <h4>Revision changelog (v{latest.version})</h4>
            <ul>
              {latest.changelog.map((item, index) => (
                <li key={index}>
                  <strong>{item.section}:</strong> {item.before} → {item.after}
                  <small> ({item.reason})</small>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <pre>{result.evaluationReport}</pre>
      </div>
    );
  }

  if (activeTab === 'transcript') {
    if (!transcripts.length) {
      return <EmptyState text="No model transcript captured yet." compact />;
    }
    const last = transcripts[transcripts.length - 1];
    return (
      <div className="transcript-wrap">
        <h4>{last.label} · {new Date(last.at).toLocaleString()}</h4>
        <h5>Prompt payload</h5>
        <pre>{JSON.stringify(last.prompt, null, 2)}</pre>
        <h5>Raw model response</h5>
        <pre>{String(last.rawResponse || '')}</pre>
      </div>
    );
  }

  if (activeTab === 'evidence') {
    return (
      <div className="evidence-wrap">
        <p>Auto-generated Stage 2 evidence from this run.</p>
        <div className="evidence-actions">
          <button className="secondary" type="button" onClick={() => downloadEvidence('workflow')}>
            workflow_usage.md
          </button>
          <button className="secondary" type="button" onClick={() => downloadEvidence('ai')}>
            AI_USAGE.md
          </button>
          <button className="secondary" type="button" onClick={() => downloadEvidence('json')}>
            run-evidence.json
          </button>
          <button className="primary" type="button" onClick={() => downloadEvidence('all')}>
            Download all
          </button>
        </div>
        <h5>workflow_usage.md preview</h5>
        <pre>{agent.buildWorkflowUsageMd()}</pre>
        <h5>AI_USAGE.md preview</h5>
        <pre>{agent.buildAiUsageMd()}</pre>
      </div>
    );
  }

  return <EmptyState text="Select an artifact tab." compact />;
}

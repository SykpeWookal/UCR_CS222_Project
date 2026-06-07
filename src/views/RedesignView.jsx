import { useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X
} from 'lucide-react';
import { ARTIFACT_TABS, ArtifactContent, EmptyState } from '../ArtifactPanel.jsx';
import { PROJECT_FIELDS, REQUIRED_FIELDS, STAGES } from '../useProposalAgent.js';

function stageDone(index, agent) {
  const { fieldSuggestions, project, result, versions, stoppingCriteria } = agent;
  if (index === 0) return Boolean(agent.topicInput);
  if (index === 1) return fieldSuggestions.length > 0;
  if (index === 2) return REQUIRED_FIELDS.some((field) => project[field]);
  if (index === 3) return Boolean(result);
  if (index === 4) return versions.length >= 2;
  if (index === 5) return stoppingCriteria.markedFinal;
  return false;
}

export default function RedesignView({ agent }) {
  const {
    health,
    status,
    error,
    memorySavedAt,
    topicInput,
    setTopicInput,
    domainInput,
    setDomainInput,
    startAgent,
    startSampleAgent,
    reset,
    clearSavedMemory,
    project,
    updateProjectField,
    acceptedCount,
    fieldSuggestions,
    currentSuggestion,
    suggestionIndex,
    setSuggestionIndex,
    acceptSuggestion,
    rejectSuggestion,
    editAndAcceptSuggestion,
    commentOnSuggestion,
    acceptedSuggestionCount,
    decisions,
    chooseOption,
    currentQuestion,
    customNote,
    setCustomNote,
    submitCustomNote,
    sources,
    addSource,
    updateSource,
    removeSource,
    recommendedRefs,
    uploadedRefs,
    refsLoading,
    findReferences,
    toggleRecommendedRef,
    uploadReference,
    toggleUploadedRef,
    removeUploadedRef,
    result,
    versions,
    coverage,
    weakClaims,
    selectedWeaknessKeys,
    toggleWeakness,
    revisionFeedback,
    setRevisionFeedback,
    generateProposal,
    reviseProposal,
    stoppingCriteria,
    markFinal,
    activeTab,
    setActiveTab,
    downloadLatex,
    downloadPdf,
    runLog
  } = agent;

  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [commentingField, setCommentingField] = useState(null);
  const [commentText, setCommentText] = useState('');
  const fileInputRef = useRef(null);

  const coveragePct = coverage.total ? Math.round((coverage.covered / coverage.total) * 100) : 0;

  function onPickFile(event) {
    const file = event.target.files?.[0];
    if (file) uploadReference(file);
    event.target.value = '';
  }

  function startEditing(suggestion) {
    setEditingField(suggestion.field);
    setEditValue(suggestion.value);
    setCommentingField(null);
  }

  function startCommenting(suggestion) {
    setCommentingField(suggestion.field);
    setCommentText('');
    setEditingField(null);
  }

  function submitComment(suggestion) {
    commentOnSuggestion(suggestion, commentText);
    setCommentingField(null);
    setCommentText('');
  }

  function saveEdit(suggestion) {
    editAndAcceptSuggestion(suggestion, editValue);
    setEditingField(null);
    setEditValue('');
  }

  return (
    <div className="rd-root">
      <header className="rd-appbar">
        <div className="rd-brand">
          <Sparkles size={18} aria-hidden="true" />
          <span>Proposal Agent</span>
        </div>
        <div className="rd-appbar-meta">
          <span className={`rd-mode ${health.mode === 'api-ready' ? 'ok' : ''}`}>
            {health.mode === 'api-ready' ? `API · ${health.model || 'model'}` : health.mode}
          </span>
          <span className="rd-memory">{memorySavedAt ? `Saved ${new Date(memorySavedAt).toLocaleTimeString()}` : 'Unsaved'}</span>
        </div>
      </header>

      <div className="rd-layout">
        <aside className="rd-rail">
          <div className="rd-card rd-intake">
            <label>
              Rough idea
              <input
                value={topicInput}
                onChange={(event) => setTopicInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') startAgent();
                }}
                placeholder="Agent for citation-grounded literature review"
              />
            </label>
            <label>
              Domain / constraints
              <input
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                placeholder="CS NLP"
              />
            </label>
            <div className="rd-intake-actions">
              <button className="rd-btn primary" disabled={!topicInput.trim() || status !== 'idle'} onClick={startAgent} type="button">
                {status === 'starting' ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
                Structure
              </button>
              <button className="rd-btn" disabled={status !== 'idle'} onClick={startSampleAgent} type="button">
                Sample
              </button>
              <button className="rd-btn" onClick={reset} type="button" aria-label="Reset">
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="rd-card rd-steps">
            <h3>Workflow</h3>
            <ol>
              {STAGES.map(([number, title, description], index) => (
                <li key={title} className={stageDone(index, agent) ? 'done' : ''}>
                  <span className="rd-step-num">{stageDone(index, agent) ? <Check size={14} aria-hidden="true" /> : number}</span>
                  <span className="rd-step-text">
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rd-card rd-gauge-card">
            <h3>Coverage</h3>
            <div className="rd-gauge">
              <div className="rd-gauge-bar" style={{ width: `${coveragePct}%` }} />
            </div>
            <div className="rd-gauge-meta">
              <span>{coverage.total ? `${coverage.covered}/${coverage.total}` : '—'} sections</span>
              <span>{acceptedCount}/{REQUIRED_FIELDS.length} fields</span>
            </div>
            <ul className="rd-stopping">
              <li className={stoppingCriteria.allCovered ? 'on' : ''}>All sections covered</li>
              <li className={stoppingCriteria.noHighWeak ? 'on' : ''}>No high-severity weak claims</li>
              <li className={stoppingCriteria.revisedOnce ? 'on' : ''}>≥1 revision loop</li>
              <li className={stoppingCriteria.markedFinal ? 'on' : ''}>Marked final</li>
            </ul>
            <button
              className="rd-btn primary block"
              type="button"
              disabled={!stoppingCriteria.canFinalize || stoppingCriteria.markedFinal}
              onClick={markFinal}
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              {stoppingCriteria.markedFinal ? 'Final' : 'Mark final'}
            </button>
            <button className="rd-link" type="button" onClick={clearSavedMemory}>
              Clear memory
            </button>
          </div>
        </aside>

        <main className="rd-main">
          {error ? <p className="rd-error">{error}</p> : null}

          <section className="rd-card">
            <h3>Structure the idea</h3>
            <div className="rd-structure">
              <div className="rd-suggestions">
                <h4>Suggestions <span>{fieldSuggestions.length}</span></h4>
                {fieldSuggestions.length ? (
                  <ul className="rd-sugg-list">
                    {fieldSuggestions.map((suggestion, index) => {
                      const accepted = project[suggestion.field] === suggestion.value;
                      const isEditing = editingField === suggestion.field;
                      const isCommenting = commentingField === suggestion.field;
                      return (
                        <li
                          key={`${suggestion.field}-${index}`}
                          className={[index === suggestionIndex ? 'active' : '', accepted ? 'accepted' : ''].join(' ')}
                          onMouseEnter={() => setSuggestionIndex(index)}
                        >
                          <div className="rd-sugg-head">
                            <strong>{suggestion.label || suggestion.field}</strong>
                            <span className={`rd-conf ${String(suggestion.confidence || 'medium').toLowerCase()}`}>
                              {suggestion.confidence || 'Medium'}
                            </span>
                          </div>
                          {isEditing ? (
                            <textarea
                              className="rd-edit"
                              value={editValue}
                              onChange={(event) => setEditValue(event.target.value)}
                            />
                          ) : (
                            <p>{suggestion.value}</p>
                          )}
                          {suggestion.reason ? <small className="rd-sugg-reason">{suggestion.reason}</small> : null}
                          <div className="rd-sugg-actions">
                            {isEditing ? (
                              <>
                                <button className="rd-btn small primary" type="button" onClick={() => saveEdit(suggestion)}>
                                  <Check size={14} aria-hidden="true" /> Save & accept
                                </button>
                                <button className="rd-btn small" type="button" onClick={() => setEditingField(null)}>
                                  <X size={14} aria-hidden="true" /> Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button className="rd-btn small" type="button" onClick={() => acceptSuggestion(suggestion)}>
                                  {accepted ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                                  {accepted ? 'Accepted' : 'Accept'}
                                </button>
                                <button className="rd-btn small" type="button" onClick={() => startEditing(suggestion)}>
                                  <Pencil size={14} aria-hidden="true" /> Edit
                                </button>
                                <button className="rd-btn small" type="button" onClick={() => rejectSuggestion(suggestion)}>
                                  <X size={14} aria-hidden="true" /> Reject
                                </button>
                                <button className="rd-btn small" type="button" onClick={() => startCommenting(suggestion)}>
                                  <MessageSquare size={14} aria-hidden="true" /> Comment
                                </button>
                              </>
                            )}
                          </div>
                          {isCommenting ? (
                            <div className="rd-comment">
                              <textarea
                                value={commentText}
                                onChange={(event) => setCommentText(event.target.value)}
                                placeholder="Tell the agent how to change this suggestion."
                              />
                              <div className="rd-sugg-actions">
                                <button
                                  className="rd-btn small primary"
                                  type="button"
                                  disabled={!commentText.trim() || status !== 'idle'}
                                  onClick={() => submitComment(suggestion)}
                                >
                                  {status === 'answering' ? (
                                    <Loader2 className="spin" size={14} aria-hidden="true" />
                                  ) : (
                                    <Send size={14} aria-hidden="true" />
                                  )}
                                  Send to agent
                                </button>
                                <button className="rd-btn small" type="button" onClick={() => setCommentingField(null)}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState text="Structure an idea to see suggestions." compact />
                )}
                <div className="rd-accepted-meta">{acceptedSuggestionCount} accepted</div>
              </div>

              <div className="rd-decisions">
                <h4>Decisions <span>{decisions.length}</span></h4>
                {decisions.length ? (
                  decisions.map((decision) => (
                    <article className="rd-decision" key={decision.id}>
                      <strong>{decision.title}</strong>
                      <p>{decision.question}</p>
                      <div className="rd-options">
                        {decision.options.map((option) => (
                          <button
                            className="rd-option"
                            key={`${decision.id}-${option.label}`}
                            type="button"
                            onClick={() => chooseOption(decision, option)}
                          >
                            <strong>{option.label}</strong>
                            <span>{option.value}</span>
                          </button>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState text="No open decisions." compact />
                )}

                <div className="rd-note">
                  <h4>Answer / note</h4>
                  {currentQuestion ? <small>{currentQuestion.question}</small> : null}
                  <textarea
                    value={customNote}
                    onChange={(event) => setCustomNote(event.target.value)}
                    placeholder={currentQuestion?.question || 'Add a missing detail.'}
                  />
                  <button className="rd-btn primary" disabled={!customNote.trim() || status !== 'idle'} onClick={submitCustomNote} type="button">
                    {status === 'answering' ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                    Integrate
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="rd-card">
            <div className="rd-card-head">
              <h3>External references</h3>
              <div className="rd-art-actions">
                <button className="rd-btn small" type="button" onClick={() => findReferences()} disabled={refsLoading}>
                  {refsLoading ? <Loader2 className="spin" size={14} aria-hidden="true" /> : <Search size={14} aria-hidden="true" />}
                  Find references
                </button>
                <button className="rd-btn small" type="button" onClick={() => fileInputRef.current?.click()} disabled={status === 'uploading'}>
                  {status === 'uploading' ? <Loader2 className="spin" size={14} aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                  Upload PDF
                </button>
                <button className="rd-btn small" type="button" onClick={addSource}>
                  <Plus size={14} aria-hidden="true" /> Add manually
                </button>
                <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" hidden onChange={onPickFile} />
              </div>
            </div>

            <p className="rd-refs-hint">
              AI-suggested references are starting points — open the link to verify before citing. Tick “Use” to include a reference in the proposal.
            </p>

            <h4>AI-recommended <span>{recommendedRefs.length}</span></h4>
            {recommendedRefs.length ? (
              <ul className="rd-ref-list">
                {recommendedRefs.map((ref) => (
                  <li key={ref.id} className={ref.use ? 'used' : ''}>
                    <label className="rd-ref-use">
                      <input type="checkbox" checked={ref.use} onChange={() => toggleRecommendedRef(ref.id)} />
                    </label>
                    <div className="rd-ref-body">
                      <div className="rd-ref-head">
                        <strong>{ref.title}</strong>
                        <span className={`rd-conf ${String(ref.relevance || 'medium').toLowerCase()}`}>{ref.relevance}</span>
                      </div>
                      <small className="rd-ref-meta">
                        {[ref.authors, ref.year, ref.venue].filter(Boolean).join(' · ')}
                      </small>
                      {ref.reason ? <small className="rd-ref-reason">{ref.reason}</small> : null}
                      <a className="rd-ref-link" href={ref.url} target="_blank" rel="noreferrer">
                        <ExternalLink size={12} aria-hidden="true" /> Open
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text={refsLoading ? 'Finding references…' : 'Structure an idea or click “Find references”.'} compact />
            )}

            {uploadedRefs.length ? (
              <>
                <h4>Your uploaded PDFs <span>{uploadedRefs.length}</span></h4>
                <ul className="rd-ref-list">
                  {uploadedRefs.map((ref) => (
                    <li key={ref.id} className={ref.use ? 'used' : ''}>
                      <label className="rd-ref-use">
                        <input type="checkbox" checked={ref.use} onChange={() => toggleUploadedRef(ref.id)} />
                      </label>
                      <div className="rd-ref-body">
                        <div className="rd-ref-head">
                          <strong><BookOpen size={13} aria-hidden="true" /> {ref.filename}</strong>
                          <button className="rd-btn icon" type="button" onClick={() => removeUploadedRef(ref.id)} aria-label="Remove">
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                        <small className="rd-ref-meta">{ref.chars} characters extracted and shared with the agent.</small>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {sources.length ? (
              <>
                <h4>Manual sources <span>{sources.length}</span></h4>
                <div className="rd-sources">
                  {sources.map((source) => (
                    <div className="rd-source" key={source.id}>
                      <input placeholder="Title" value={source.title} onChange={(event) => updateSource(source.id, 'title', event.target.value)} />
                      <input placeholder="Link/note" value={source.link} onChange={(event) => updateSource(source.id, 'link', event.target.value)} />
                      <input placeholder="Used for" value={source.usedFor} onChange={(event) => updateSource(source.id, 'usedFor', event.target.value)} />
                      <button className="rd-btn icon" type="button" onClick={() => removeSource(source.id)} aria-label="Remove">
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          <section className="rd-card">
            <div className="rd-card-head">
              <h3>Project state</h3>
              <button className="rd-btn primary" disabled={!project.title || status !== 'idle'} onClick={generateProposal} type="button">
                {status === 'drafting' ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}
                {versions.length ? 'Regenerate' : 'Generate proposal'}
              </button>
            </div>
            <div className="rd-fields">
              {PROJECT_FIELDS.map(([field, label, multiline]) => (
                <label key={field} className={multiline ? 'wide' : ''}>
                  {label}
                  {multiline ? (
                    <textarea value={project[field] || ''} onChange={(event) => updateProjectField(field, event.target.value)} />
                  ) : (
                    <input value={project[field] || ''} onChange={(event) => updateProjectField(field, event.target.value)} />
                  )}
                </label>
              ))}
            </div>
          </section>

          {result ? (
            <section className="rd-card">
              <div className="rd-card-head">
                <h3>Critique & revise</h3>
                <div className="rd-versions">
                  {versions.map((version) => (
                    <span key={version.version}>v{version.version}: {version.coverage?.covered || 0}/{version.coverage?.total || 0}</span>
                  ))}
                </div>
              </div>
              <div className="rd-revise">
                <div className="rd-weaks">
                  {weakClaims.length ? (
                    weakClaims.map((item, index) => (
                      <label key={index} className={`rd-weak sev-${String(item.severity).toLowerCase()}`}>
                        <input
                          type="checkbox"
                          checked={selectedWeaknessKeys.includes(String(index))}
                          onChange={() => toggleWeakness(String(index))}
                        />
                        <span>
                          <strong>[{item.severity}]</strong> {item.claim}
                          <small>{item.fix}</small>
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="rd-muted">No weak claims detected.</p>
                  )}
                </div>
                <div className="rd-revise-controls">
                  <textarea
                    value={revisionFeedback}
                    onChange={(event) => setRevisionFeedback(event.target.value)}
                    placeholder="Optional feedback for the revision."
                  />
                  <button
                    className="rd-btn primary block"
                    type="button"
                    disabled={status !== 'idle' || (!selectedWeaknessKeys.length && !revisionFeedback.trim())}
                    onClick={reviseProposal}
                  >
                    {status === 'revising' ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Wand2 size={16} aria-hidden="true" />}
                    Apply revision
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rd-card">
            <div className="rd-card-head">
              <h3>Artifacts</h3>
              <div className="rd-art-actions">
                <button className="rd-btn small" type="button" disabled={!result?.proposalLatex} onClick={downloadLatex}>
                  <Download size={14} aria-hidden="true" /> .tex
                </button>
                <button className="rd-btn small primary" type="button" disabled={!result?.proposalLatex || status !== 'idle'} onClick={downloadPdf}>
                  {status === 'exporting' ? <Loader2 className="spin" size={14} aria-hidden="true" /> : <Download size={14} aria-hidden="true" />} .pdf
                </button>
              </div>
            </div>
            <nav className="rd-tabs">
              {ARTIFACT_TABS.map(([id, label]) => (
                <button key={id} className={activeTab === id ? 'active' : ''} type="button" onClick={() => setActiveTab(id)}>
                  {label}
                </button>
              ))}
            </nav>
            <div className="rd-artifact">
              <ArtifactContent agent={agent} />
            </div>
          </section>

          <section className="rd-card">
            <h3>Run log</h3>
            {runLog.length ? (
              <ol className="rd-runlog">
                {runLog.map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.stage}</span>
                    <p>{entry.message}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState text="Run log appears after you structure an idea." compact />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

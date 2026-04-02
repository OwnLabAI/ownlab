'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Play,
  RefreshCw,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  LatexCompileDiagnostic,
  LatexCompileResult,
  LatexEngine,
  LatexEnvironmentInfo,
} from '@/lib/api';
import {
  compileWorkspaceLatexFile,
  fetchWorkspaceLatexEnvironment,
  fetchWorkspaceLatexFiles,
  updateWorkspaceFileContent,
} from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const LATEX_ENGINES: LatexEngine[] = ['tectonic', 'latexmk', 'xelatex', 'pdflatex', 'lualatex'];
const AUXILIARY_TEXT_EXTENSIONS = new Set(['.bib', '.sty', '.cls', '.bst']);

type DetailTab = 'pdf' | 'errors' | 'log';

function formatEnvironmentLabel(environment: LatexEnvironmentInfo | null, isChecking: boolean) {
  if (isChecking) {
    return 'Checking';
  }

  switch (environment?.status) {
    case 'ready':
      return 'Ready';
    case 'missing':
      return 'Missing';
    case 'error':
      return 'Error';
    default:
      return 'Checking';
  }
}

function getEnvironmentVariant(environment: LatexEnvironmentInfo | null, isChecking: boolean) {
  if (isChecking) {
    return 'outline' as const;
  }

  switch (environment?.status) {
    case 'ready':
      return 'secondary' as const;
    case 'missing':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
}

function countDiagnostics(
  diagnostics: LatexCompileDiagnostic[] | undefined,
  severity: LatexCompileDiagnostic['severity'],
) {
  return diagnostics?.filter((item) => item.severity === severity).length ?? 0;
}

function getOutputPreviewUrl(workspaceId: string, outputPath: string, runId: string) {
  return `/api/workspace/${encodeURIComponent(workspaceId)}/latex/output?path=${encodeURIComponent(outputPath)}&v=${encodeURIComponent(runId)}`;
}

interface WorkspaceLatexFileViewProps {
  workspaceId: string;
  filePath: string;
  content: string;
  onSaved: (nextContent: string) => void;
}

export function WorkspaceLatexFileView({
  workspaceId,
  filePath,
  content,
  onSaved,
}: WorkspaceLatexFileViewProps) {
  const [draft, setDraft] = useState(content);
  const [environment, setEnvironment] = useState<LatexEnvironmentInfo | null>(null);
  const [texFiles, setTexFiles] = useState<string[]>([]);
  const [selectedMainFile, setSelectedMainFile] = useState(filePath);
  const [selectedEngine, setSelectedEngine] = useState<LatexEngine>('tectonic');
  const [result, setResult] = useState<(LatexCompileResult & { environment?: LatexEnvironmentInfo }) | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('pdf');
  const [isCheckingEnvironment, startEnvironmentRefresh] = useTransition();
  const [isLoadingTexFiles, startFileListRefresh] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();
  const [isCompiling, startCompileTransition] = useTransition();
  const latestSavedRef = useRef(content);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(content);
    latestSavedRef.current = content;
  }, [content, filePath]);

  useEffect(() => {
    setSelectedMainFile(filePath);
  }, [filePath]);

  useEffect(() => {
    startEnvironmentRefresh(async () => {
      try {
        const nextEnvironment = await fetchWorkspaceLatexEnvironment(workspaceId);
        setEnvironment(nextEnvironment);
        if (nextEnvironment.recommendedEngine) {
          setSelectedEngine((current) =>
            nextEnvironment.detectedEngines.includes(current)
              ? current
              : nextEnvironment.recommendedEngine ?? current,
          );
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to check LaTeX environment');
      }
    });

    startFileListRefresh(async () => {
      try {
        const nextFiles = await fetchWorkspaceLatexFiles(workspaceId);
        setTexFiles(nextFiles.files);
        if (nextFiles.files.includes(filePath)) {
          setSelectedMainFile((current) => (nextFiles.files.includes(current) ? current : filePath));
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to fetch LaTeX files');
      }
    });
  }, [filePath, workspaceId]);

  const hasUnsavedChanges = draft !== latestSavedRef.current;
  const lineCount = useMemo(() => (draft ? draft.split('\n').length : 0), [draft]);
  const diagnostics = result?.diagnostics ?? [];
  const errorCount = countDiagnostics(diagnostics, 'error');
  const warningCount = countDiagnostics(diagnostics, 'warning');
  const previewUrl =
    result?.outputPdfPath ? getOutputPreviewUrl(workspaceId, result.outputPdfPath, result.runId) : null;
  const availableEngines = environment?.detectedEngines?.length
    ? environment.detectedEngines
    : LATEX_ENGINES;
  const environmentLabel = formatEnvironmentLabel(environment, isCheckingEnvironment);
  const environmentVariant = getEnvironmentVariant(environment, isCheckingEnvironment);

  async function saveDraft(nextDraft = draft) {
    await updateWorkspaceFileContent(workspaceId, filePath, nextDraft);
    latestSavedRef.current = nextDraft;
    onSaved(nextDraft);
  }

  function handleSave() {
    if (!hasUnsavedChanges) {
      return;
    }

    startSaveTransition(async () => {
      try {
        await saveDraft();
      } catch (error) {
        console.error('Failed to save LaTeX file:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to save LaTeX file');
      }
    });
  }

  function handleJumpToLine(line: number | null) {
    if (!line || !textareaRef.current) {
      return;
    }

    const lines = draft.split('\n');
    const safeLineIndex = Math.max(0, Math.min(line - 1, lines.length - 1));
    const selectionStart = lines.slice(0, safeLineIndex).reduce((sum, entry) => sum + entry.length + 1, 0);
    const selectionEnd = selectionStart + (lines[safeLineIndex]?.length ?? 0);

    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(selectionStart, selectionEnd);
    const lineHeight = 24;
    textareaRef.current.scrollTop = Math.max(0, safeLineIndex * lineHeight - lineHeight * 2);
  }

  function handleCompile() {
    startCompileTransition(async () => {
      try {
        if (hasUnsavedChanges) {
          await saveDraft();
        }

        const compileResult = await compileWorkspaceLatexFile(workspaceId, {
          mainFilePath: selectedMainFile,
          engine: selectedEngine,
        });

        setEnvironment(compileResult.environment);
        setResult(compileResult);
        setDetailTab(compileResult.ok ? 'pdf' : compileResult.diagnostics.length > 0 ? 'errors' : 'log');

        if (compileResult.ok) {
          toast.success('LaTeX compiled successfully');
        } else {
          toast.error(compileResult.error ?? 'Compilation finished without a PDF');
        }
      } catch (error) {
        const nextEnvironment =
          error instanceof Error && 'environment' in error
            ? ((error as Error & { environment?: LatexEnvironmentInfo }).environment ?? null)
            : null;

        if (nextEnvironment) {
          setEnvironment(nextEnvironment);
          setDetailTab('log');
        }

        toast.error(error instanceof Error ? error.message : 'Failed to compile LaTeX file');
      }
    });
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onKeyDownCapture={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          event.stopPropagation();
          handleSave();
          return;
        }

        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          handleCompile();
        }
      }}
    >
      <header className="flex shrink-0 flex-col gap-3 border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <h2 className="truncate text-base font-medium text-foreground">
                {filePath.split('/').pop() ?? filePath}
              </h2>
              {AUXILIARY_TEXT_EXTENSIONS.has(filePath.slice(filePath.lastIndexOf('.')).toLowerCase()) ? null : (
                <Badge variant={environmentVariant} className="gap-1 rounded-full px-2.5">
                  {environment?.status === 'ready' ? <CheckCircle2 className="size-3" /> : null}
                  {environment?.status === 'missing' ? <AlertCircle className="size-3" /> : null}
                  {isCheckingEnvironment ? <LoaderCircle className="size-3 animate-spin" /> : null}
                  {environmentLabel}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Edit locally, compile in this workspace, and preview the generated PDF without leaving the viewboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                startEnvironmentRefresh(async () => {
                  try {
                    const nextEnvironment = await fetchWorkspaceLatexEnvironment(workspaceId);
                    setEnvironment(nextEnvironment);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Failed to refresh LaTeX environment');
                  }
                })
              }
              disabled={isCheckingEnvironment}
            >
              <RefreshCw className={cn('size-4', isCheckingEnvironment && 'animate-spin')} />
              Re-check
            </Button>
            <Button
              type="button"
              variant={hasUnsavedChanges ? 'default' : 'outline'}
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
            >
              <Save className="size-4" />
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCompile}
              disabled={isCompiling || environment?.status === 'missing'}
            >
              {isCompiling ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
              Compile
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5">
            <span className="text-xs text-muted-foreground">Main file</span>
            <Select value={selectedMainFile} onValueChange={setSelectedMainFile}>
              <SelectTrigger size="sm" className="min-w-[12rem] border-0 bg-transparent px-0 py-0 shadow-none">
                <SelectValue placeholder={isLoadingTexFiles ? 'Loading…' : 'Select main file'} />
              </SelectTrigger>
              <SelectContent>
                {(texFiles.length > 0 ? texFiles : [filePath]).map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5">
            <span className="text-xs text-muted-foreground">Engine</span>
            <Select value={selectedEngine} onValueChange={(value) => setSelectedEngine(value as LatexEngine)}>
              <SelectTrigger size="sm" className="min-w-[8rem] border-0 bg-transparent px-0 py-0 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableEngines.map((engine) => (
                  <SelectItem key={engine} value={engine}>
                    {engine}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground">
            {lineCount > 0 ? `${lineCount} lines` : 'Empty file'}
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="min-h-0 border-b lg:border-b-0 lg:border-r">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={handleSave}
            spellCheck={false}
            className="h-full min-h-[24rem] w-full resize-none border-0 bg-transparent px-4 py-4 font-mono text-[13px] leading-6 text-foreground outline-none"
            placeholder="Write LaTeX here..."
          />
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden bg-muted/15">
          <div className="flex shrink-0 items-center gap-1 border-b px-3 py-2">
            {([
              { id: 'pdf', label: 'PDF' },
              { id: 'errors', label: `Errors${errorCount ? ` ${errorCount}` : ''}` },
              { id: 'log', label: `Log${warningCount ? ` ${warningCount}` : ''}` },
            ] as Array<{ id: DetailTab; label: string }>).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDetailTab(tab.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  detailTab === tab.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {environment?.status === 'missing' ? (
            <div className="flex min-h-0 flex-1 items-center justify-center p-4">
              <div className="max-w-md rounded-3xl border border-dashed border-border/70 bg-background/90 p-5">
                <p className="text-sm font-medium text-foreground">No local LaTeX compiler detected</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  OwnLab can keep editing this file, but compiling to PDF needs a local compiler first.
                </p>
                {environment.installHint ? (
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">{environment.installHint}</p>
                ) : null}
              </div>
            </div>
          ) : detailTab === 'pdf' ? (
            previewUrl ? (
              <iframe
                key={previewUrl}
                src={previewUrl}
                title={`${selectedMainFile} PDF preview`}
                className="h-full min-h-[22rem] w-full bg-background"
              />
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                <div className="max-w-sm text-center">
                  <p className="text-sm font-medium text-foreground">PDF preview will appear here</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Save your changes and run a compile. The generated PDF stays inside this workspace.
                  </p>
                </div>
              </div>
            )
          ) : detailTab === 'errors' ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {diagnostics.length > 0 ? (
                <div className="space-y-2">
                  {diagnostics.map((diagnostic, index) => (
                    <button
                      key={`${diagnostic.raw}-${index}`}
                      type="button"
                      onClick={() => handleJumpToLine(diagnostic.line)}
                      className="flex w-full flex-col rounded-2xl border border-border/60 bg-background/90 px-3 py-3 text-left transition-colors hover:bg-accent/30"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Badge
                          variant={diagnostic.severity === 'error' ? 'destructive' : 'outline'}
                          className="rounded-full"
                        >
                          {diagnostic.severity}
                        </Badge>
                        <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                          {diagnostic.line ? `Line ${diagnostic.line}` : 'General'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground">{diagnostic.message}</p>
                      {diagnostic.file ? (
                        <p className="mt-1 text-xs text-muted-foreground">{diagnostic.file}</p>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-[18rem] items-center justify-center text-center">
                  <div>
                    <p className="text-sm font-medium text-foreground">No parsed errors yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Compilation diagnostics will show here when LaTeX reports a line-level issue.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {result?.error ? (
                <div className="mb-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {result.error}
                </div>
              ) : null}
              <pre className="whitespace-pre-wrap break-words rounded-2xl border border-border/60 bg-background/90 p-3 font-mono text-[12px] leading-5 text-foreground">
                {result?.log || 'Compilation output will appear here.'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

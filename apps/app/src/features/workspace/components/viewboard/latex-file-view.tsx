'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Play,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  LatexCompileDiagnostic,
  LatexCompileResult,
  LatexEngine,
  LatexEnvironmentInfo,
  LatexSavedOutput,
} from '@/lib/api';
import {
  buildOwnlabApiUrl,
  compileWorkspaceLatexFile,
  fetchWorkspaceLatexEnvironment,
  fetchWorkspaceLatexFiles,
  fetchWorkspaceLatestLatexOutput,
} from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CodeEditor, type CodeEditorRef } from './code-editor';
import { PdfPreviewFrame } from './pdf-preview-frame';

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
  return buildOwnlabApiUrl(
    `/api/workspace/${encodeURIComponent(workspaceId)}/latex/output?path=${encodeURIComponent(outputPath)}&v=${encodeURIComponent(runId)}`,
  );
}

interface LatexFileViewProps {
  workspaceId: string;
  filePath: string;
  content: string;
  isDirty: boolean;
  onChange: (nextContent: string) => void;
  onSave: () => Promise<void>;
}

export function LatexFileView({
  workspaceId,
  filePath,
  content,
  isDirty,
  onChange,
  onSave,
}: LatexFileViewProps) {
  const [environment, setEnvironment] = useState<LatexEnvironmentInfo | null>(null);
  const [detectedMainFile, setDetectedMainFile] = useState(filePath);
  const [selectedEngine, setSelectedEngine] = useState<LatexEngine>('tectonic');
  const [result, setResult] = useState<(LatexCompileResult & { environment?: LatexEnvironmentInfo }) | null>(null);
  const [savedOutput, setSavedOutput] = useState<LatexSavedOutput | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('pdf');
  const [isCheckingEnvironment, startEnvironmentRefresh] = useTransition();
  const [isLoadingTexFiles, startFileListRefresh] = useTransition();
  const [isCompiling, startCompileTransition] = useTransition();
  const editorRef = useRef<CodeEditorRef | null>(null);

  useEffect(() => {
    setResult(null);
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
        const nextFiles = await fetchWorkspaceLatexFiles(workspaceId, filePath);
        setDetectedMainFile(nextFiles.detectedMainFilePath ?? filePath);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to fetch LaTeX files');
      }
    });
  }, [filePath, workspaceId]);

  const lineCount = useMemo(() => (content ? content.split('\n').length : 0), [content]);
  const diagnostics = result?.diagnostics ?? [];
  const errorCount = countDiagnostics(diagnostics, 'error');
  const warningCount = countDiagnostics(diagnostics, 'warning');
  const previewUrl =
    result?.mainFilePath === detectedMainFile && result?.outputPdfPath
      ? getOutputPreviewUrl(workspaceId, result.outputPdfPath, result.runId)
      : savedOutput?.outputPdfPath
        ? getOutputPreviewUrl(workspaceId, savedOutput.outputPdfPath, savedOutput.runId)
        : null;
  const availableEngines = environment?.detectedEngines?.length
    ? environment.detectedEngines
    : LATEX_ENGINES;
  const environmentLabel = formatEnvironmentLabel(environment, isCheckingEnvironment);
  const environmentVariant = getEnvironmentVariant(environment, isCheckingEnvironment);
  const [showPreviewPane, setShowPreviewPane] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!detectedMainFile) {
      setSavedOutput(null);
      return;
    }

    void fetchWorkspaceLatestLatexOutput(workspaceId, filePath)
      .then((nextOutput) => {
        if (cancelled) {
          return;
        }
        setSavedOutput(nextOutput);
        setShowPreviewPane(Boolean(nextOutput?.outputPdfPath));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setSavedOutput(null);
        setShowPreviewPane(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detectedMainFile, filePath, workspaceId]);

  function handleJumpToLine(line: number | null) {
    if (!line) {
      return;
    }
    editorRef.current?.focusLine(line);
  }

  function handleCompile() {
    startCompileTransition(async () => {
      try {
        if (isDirty) {
          await onSave();
        }

        const compileResult = await compileWorkspaceLatexFile(workspaceId, {
          mainFilePath: filePath,
          engine: selectedEngine,
        });

        setEnvironment(compileResult.environment);
        setResult(compileResult);
        setDetectedMainFile(compileResult.mainFilePath);
        setSavedOutput(
          compileResult.outputPdfPath
            ? {
                runId: compileResult.runId,
                mainFilePath: compileResult.mainFilePath,
                outputPdfPath: compileResult.outputPdfPath,
                logPath: compileResult.logPath,
                finishedAt: compileResult.finishedAt,
              }
            : null,
        );
        setShowPreviewPane(true);
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
          void onSave();
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
              variant={showPreviewPane ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => {
                setShowPreviewPane((current) => !current);
                if (!showPreviewPane) {
                  setDetailTab('pdf');
                }
              }}
            >
              PDF
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
            <div className="min-w-[12rem] truncate text-sm text-foreground">
              {isLoadingTexFiles ? 'Detecting…' : detectedMainFile || filePath}
            </div>
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

      <ResizablePanelGroup
        id={`workspace-latex-view-${workspaceId}`}
        direction="horizontal"
        className="min-h-0 flex-1"
      >
        <ResizablePanel
          id={`workspace-latex-source-${workspaceId}`}
          order={1}
          defaultSize={showPreviewPane ? 56 : 100}
          minSize={28}
          className="min-h-0 min-w-0 overflow-hidden"
        >
          <div className="min-h-0 h-full border-r">
            <CodeEditor
              ref={editorRef}
              filePath={filePath}
              language="tex"
              value={content}
              onChange={onChange}
              placeholderText="Write LaTeX here..."
            />
          </div>
        </ResizablePanel>

        {showPreviewPane ? (
          <>
            <ResizableHandle
              id={`workspace-latex-handle-${workspaceId}`}
              className="group w-1.5 shrink-0 cursor-col-resize rounded-full bg-transparent transition-colors hover:bg-accent/70 data-[resize-handle-active]:bg-accent"
            />

            <ResizablePanel
              id={`workspace-latex-preview-${workspaceId}`}
              order={2}
              defaultSize={44}
              minSize={24}
              className="min-h-0 min-w-0 overflow-hidden"
            >
              <div className="flex min-h-0 h-full flex-col overflow-hidden bg-muted/15">
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
                      {environment.installHint ? (
                        <p className="mt-3 text-xs leading-5 text-muted-foreground">{environment.installHint}</p>
                      ) : null}
                    </div>
                  </div>
                ) : detailTab === 'pdf' ? (
                  previewUrl ? (
                    <PdfPreviewFrame
                      src={previewUrl}
                      title={`${detectedMainFile} PDF preview`}
                      className="h-full min-h-[22rem] w-full"
                    />
                  ) : (
                    <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                      <div className="max-w-sm text-center">
                        <p className="text-sm font-medium text-foreground">Compile to preview</p>
                      </div>
                    </div>
                  )
                ) : detailTab === 'errors' ? (
                  <div className="ownlab-viewboard-scroll min-h-0 flex-1 overflow-y-auto p-3">
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
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="ownlab-viewboard-scroll min-h-0 flex-1 overflow-auto p-3">
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
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}

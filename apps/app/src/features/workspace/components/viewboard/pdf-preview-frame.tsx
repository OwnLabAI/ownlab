'use client';

import type { ComponentProps } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  LoaderCircle,
  Maximize2,
  RefreshCw,
  Search as SearchIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from 'lucide-react';
import { SpecialZoomLevel, Viewer, Worker } from '@react-pdf-viewer/core';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { searchPlugin } from '@react-pdf-viewer/search';
import { SelectionMode, selectionModePlugin } from '@react-pdf-viewer/selection-mode';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const PDF_WORKER_URL = '/vendor/react-pdf-viewer/pdf.worker.min.js';

type PdfPreviewFrameProps = Omit<ComponentProps<'div'>, 'children'> & {
  src: string;
  title?: string;
  onRefresh?: () => void;
};

export function PdfPreviewFrame({
  className,
  src,
  title,
  onRefresh,
  ...props
}: PdfPreviewFrameProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const currentScaleRef = useRef(1);
  const fitWidthFrameRef = useRef<number | null>(null);
  const zoomPluginInstance = zoomPlugin();
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const searchPluginInstance = searchPlugin();
  const selectionModePluginInstance = selectionModePlugin({
    selectionMode: SelectionMode.Text,
  });
  const [searchOpen, setSearchOpen] = useState(false);

  const { ZoomIn, ZoomOut, CurrentScale } = zoomPluginInstance;
  const { CurrentPageInput, NumberOfPages } = pageNavigationPluginInstance;
  const { Search } = searchPluginInstance;

  const zoomToBestFit = useCallback((mode: 'width' | 'page') => {
    const root = rootRef.current;
    const innerPages = root?.querySelector<HTMLElement>('.rpv-core__inner-pages');
    const pageLayer = root?.querySelector<HTMLElement>('.rpv-core__page-layer');

    if (!innerPages || !pageLayer) {
      zoomPluginInstance.zoomTo(
        mode === 'width' ? SpecialZoomLevel.PageWidth : SpecialZoomLevel.PageFit,
      );
      return;
    }

    const styles = window.getComputedStyle(innerPages);
    const paddingX = parseFloat(styles.paddingLeft || '0') + parseFloat(styles.paddingRight || '0');
    const paddingY = parseFloat(styles.paddingTop || '0') + parseFloat(styles.paddingBottom || '0');
    const availableWidth = Math.max(1, innerPages.clientWidth - paddingX);
    const availableHeight = Math.max(1, innerPages.clientHeight - paddingY);
    const pageWidth = Math.max(1, pageLayer.getBoundingClientRect().width);
    const pageHeight = Math.max(1, pageLayer.getBoundingClientRect().height);
    const currentScale = currentScaleRef.current || 1;

    const nextScale =
      mode === 'width'
        ? currentScale * (availableWidth / pageWidth)
        : currentScale * Math.min(availableWidth / pageWidth, availableHeight / pageHeight);

    zoomPluginInstance.zoomTo(nextScale);
  }, [zoomPluginInstance]);

  const scheduleFitWidth = useCallback(() => {
    if (fitWidthFrameRef.current !== null) {
      window.cancelAnimationFrame(fitWidthFrameRef.current);
    }

    fitWidthFrameRef.current = window.requestAnimationFrame(() => {
      fitWidthFrameRef.current = window.requestAnimationFrame(() => {
        zoomToBestFit('width');
        fitWidthFrameRef.current = null;
      });
    });
  }, [zoomToBestFit]);

  useEffect(() => {
    return () => {
      if (fitWidthFrameRef.current !== null) {
        window.cancelAnimationFrame(fitWidthFrameRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn('flex h-full min-h-[32rem] flex-col overflow-hidden bg-transparent', className)}
      {...props}
    >
      <Worker workerUrl={PDF_WORKER_URL}>
        <div className="ownlab-pdf-viewer flex h-full min-h-[32rem] flex-col overflow-hidden">
          <div className="ownlab-pdf-toolbar shrink-0 border-b border-border/70 bg-background/92 px-3 py-2 backdrop-blur">
            <Search>
              {(searchProps) => (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <ZoomOut>
                      {(zoomOutProps) => (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-md text-muted-foreground hover:text-foreground"
                          onClick={zoomOutProps.onClick}
                          aria-label="Zoom out"
                        >
                          <ZoomOutIcon className="size-4" />
                        </Button>
                      )}
                    </ZoomOut>
                    <ZoomIn>
                      {(zoomInProps) => (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-md text-muted-foreground hover:text-foreground"
                          onClick={zoomInProps.onClick}
                          aria-label="Zoom in"
                        >
                          <ZoomInIcon className="size-4" />
                        </Button>
                      )}
                    </ZoomIn>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-md text-muted-foreground hover:text-foreground"
                      onClick={() => zoomToBestFit('width')}
                      aria-label="Fit width"
                    >
                      <ArrowLeftRight className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-md text-muted-foreground hover:text-foreground"
                      onClick={() => zoomToBestFit('page')}
                      aria-label="Fit page"
                    >
                      <Maximize2 className="size-4" />
                    </Button>
                    <div className="mx-1 h-5 w-px bg-border/80" />
                    <CurrentScale>
                      {(scaleProps) => (
                        (() => {
                          currentScaleRef.current = scaleProps.scale;
                          return (
                            <div className="min-w-12 text-sm font-medium tabular-nums text-foreground/85">
                              {Math.round(scaleProps.scale * 100)}%
                            </div>
                          );
                        })()
                      )}
                    </CurrentScale>
                  </div>

                  <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <CurrentPageInput />
                    <span>of</span>
                    <NumberOfPages />
                  </div>

                  <div className="flex min-w-0 items-center gap-1.5">
                    {onRefresh ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-md text-muted-foreground hover:text-foreground"
                        onClick={onRefresh}
                        aria-label="Refresh PDF"
                      >
                        <RefreshCw className="size-4" />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={cn(
                        'rounded-md text-muted-foreground hover:text-foreground',
                        searchOpen && 'bg-accent/45 text-foreground',
                      )}
                      onClick={() => setSearchOpen((current) => !current)}
                      aria-label="Search PDF"
                    >
                      <SearchIcon className="size-4" />
                    </Button>
                    {searchOpen ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={searchProps.keyword}
                          onChange={(event) => searchProps.setKeyword(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              if (event.shiftKey) {
                                searchProps.jumpToPreviousMatch();
                              } else {
                                void searchProps.search();
                                searchProps.jumpToNextMatch();
                              }
                            }
                            if (event.key === 'Escape') {
                              setSearchOpen(false);
                              searchProps.clearKeyword();
                            }
                          }}
                          placeholder="Search"
                          className="h-8 w-36"
                        />
                        <div className="min-w-14 text-right text-xs tabular-nums text-muted-foreground">
                          {searchProps.numberOfMatches > 0
                            ? `${Math.min(searchProps.currentMatch + 1, searchProps.numberOfMatches)}/${searchProps.numberOfMatches}`
                            : '0/0'}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </Search>
          </div>

          <div className="min-h-0 flex-1">
            <Viewer
              key={src}
              fileUrl={src}
              defaultScale={SpecialZoomLevel.PageWidth}
              onDocumentLoad={scheduleFitWidth}
              plugins={[
                zoomPluginInstance,
                pageNavigationPluginInstance,
                searchPluginInstance,
                selectionModePluginInstance,
              ]}
              renderLoader={(percentages: number) => (
                <div className="flex h-full min-h-[24rem] items-center justify-center">
                  <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur">
                    <LoaderCircle className="size-4 animate-spin" />
                    Loading PDF {Math.round(percentages)}%
                  </div>
                </div>
              )}
              renderError={(error) => (
                <div className="flex h-full min-h-[24rem] items-center justify-center p-6">
                  <div className="max-w-md rounded-2xl border border-border/70 bg-background/95 p-5 text-center shadow-sm">
                    <p className="text-sm font-medium text-foreground">Preview unavailable</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {'message' in error && typeof error.message === 'string'
                        ? error.message
                        : `Failed to load ${title?.trim() || 'PDF document'}.`}
                    </p>
                  </div>
                </div>
              )}
              theme="light"
            />
          </div>
        </div>
      </Worker>
    </div>
  );
}

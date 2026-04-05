"use client";

import type { ComponentProps } from "react";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { Streamdown } from "streamdown";

type StreamdownRendererProps = ComponentProps<typeof Streamdown> & {
  withPlugins?: boolean;
};

const streamdownPlugins = { cjk, code, math, mermaid };

export function StreamdownRenderer({
  children,
  className,
  components,
  withPlugins = false,
}: StreamdownRendererProps) {
  return (
    <Streamdown
      className={className}
      components={components}
      plugins={withPlugins ? streamdownPlugins : undefined}
    >
      {children}
    </Streamdown>
  );
}

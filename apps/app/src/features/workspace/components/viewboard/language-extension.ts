'use client';

import { css } from '@codemirror/lang-css';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { vue } from '@codemirror/lang-vue';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { StreamLanguage } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { c, cpp, csharp, kotlin } from '@codemirror/legacy-modes/mode/clike';
import { diff } from '@codemirror/legacy-modes/mode/diff';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { nginx } from '@codemirror/legacy-modes/mode/nginx';
import { perl } from '@codemirror/legacy-modes/mode/perl';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { r } from '@codemirror/legacy-modes/mode/r';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { sass } from '@codemirror/legacy-modes/mode/sass';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { cmake } from '@codemirror/legacy-modes/mode/cmake';

export type CodeLanguage = 'plain' | 'markdown' | 'tex';

function legacy(parser: Parameters<typeof StreamLanguage.define>[0], commentToken?: string): Extension {
  const extension = StreamLanguage.define(parser);
  if (!commentToken) {
    return extension;
  }
  return extension.data.of({ commentTokens: { line: commentToken } });
}

const texExtension = StreamLanguage.define(stex).data.of({
  commentTokens: { line: '%' },
  closeBrackets: { brackets: ['(', '[', '{', "'"] },
});

const markdownExtension = markdown();

function getExtensionByName(filename: string): Extension {
  const lower = filename.toLowerCase();
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : '';
  const baseName = lower.split('/').pop() ?? lower;

  if (baseName === 'dockerfile') return legacy(dockerFile, '#');
  if (baseName === 'makefile') return legacy(shell, '#');
  if (baseName === '.gitignore' || baseName === '.env' || baseName.endsWith('.env')) return legacy(shell, '#');
  if (baseName === 'nginx.conf') return legacy(nginx, '#');
  if (baseName === 'cmakelists.txt') return legacy(cmake, '#');

  switch (ext) {
    case 'js':
    case 'mjs':
    case 'cjs':
      return javascript();
    case 'jsx':
      return javascript({ jsx: true });
    case 'ts':
    case 'mts':
    case 'cts':
      return javascript({ typescript: true });
    case 'tsx':
      return javascript({ typescript: true, jsx: true });
    case 'html':
    case 'htm':
      return html();
    case 'css':
      return css();
    case 'json':
    case 'jsonc':
      return json();
    case 'md':
    case 'markdown':
    case 'mdx':
    case 'mdown':
    case 'mkd':
      return markdownExtension;
    case 'py':
      return python();
    case 'go':
      return go();
    case 'rs':
      return rust();
    case 'sql':
      return sql();
    case 'yaml':
    case 'yml':
      return yaml();
    case 'xml':
    case 'svg':
    case 'plist':
    case 'xsd':
      return xml();
    case 'java':
      return java();
    case 'php':
      return php();
    case 'vue':
      return vue();
    case 'c':
    case 'h':
      return legacy(c, '//');
    case 'cc':
    case 'cpp':
    case 'cxx':
    case 'hh':
    case 'hpp':
    case 'hxx':
      return legacy(cpp, '//');
    case 'cs':
      return legacy(csharp, '//');
    case 'kt':
    case 'kts':
      return legacy(kotlin, '//');
    case 'sh':
    case 'bash':
    case 'zsh':
      return legacy(shell, '#');
    case 'toml':
      return legacy(toml, '#');
    case 'conf':
      return legacy(properties, '#');
    case 'ini':
    case 'properties':
      return legacy(properties, '#');
    case 'lua':
      return legacy(lua, '--');
    case 'scss':
    case 'sass':
      return legacy(sass, '//');
    case 'rb':
      return legacy(ruby, '#');
    case 'pl':
    case 'pm':
      return legacy(perl, '#');
    case 'r':
      return legacy(r, '#');
    case 'swift':
      return legacy(swift, '//');
    case 'cmake':
      return legacy(cmake, '#');
    case 'diff':
    case 'patch':
      return legacy(diff);
    case 'tex':
    case 'bib':
    case 'sty':
    case 'cls':
    case 'bst':
      return texExtension;
    default:
      return [];
  }
}

export function resolveCodeLanguage(filePath: string | undefined, language?: CodeLanguage): Extension {
  if (language === 'markdown') {
    return markdownExtension;
  }

  if (language === 'tex') {
    return texExtension;
  }

  if (!filePath) {
    return [];
  }

  return getExtensionByName(filePath);
}

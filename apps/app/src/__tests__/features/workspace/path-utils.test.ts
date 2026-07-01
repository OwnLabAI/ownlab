import { describe, expect, it } from 'vitest';
import { normalizeWorkspaceSelectionPath } from '@/features/workspace/path-utils';

describe('normalizeWorkspaceSelectionPath', () => {
  it('strips trailing line and column suffixes from file selections', () => {
    expect(normalizeWorkspaceSelectionPath('paper/sections/7-Evaluation.tex:9')).toBe(
      'paper/sections/7-Evaluation.tex',
    );
    expect(normalizeWorkspaceSelectionPath('paper/sections/7-Evaluation.tex:9:3')).toBe(
      'paper/sections/7-Evaluation.tex',
    );
  });

  it('strips hash-based line anchors from file selections', () => {
    expect(normalizeWorkspaceSelectionPath('paper/sections/7-Evaluation.tex#L9')).toBe(
      'paper/sections/7-Evaluation.tex',
    );
    expect(normalizeWorkspaceSelectionPath('paper/sections/7-Evaluation.tex#L9-L18')).toBe(
      'paper/sections/7-Evaluation.tex',
    );
  });

  it('keeps regular relative file paths unchanged', () => {
    expect(normalizeWorkspaceSelectionPath('paper/sections/7-Evaluation.tex')).toBe(
      'paper/sections/7-Evaluation.tex',
    );
  });
});

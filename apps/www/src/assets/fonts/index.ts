type FontToken = {
  className: string;
  variable: string;
};

function createFontToken(variable: string): FontToken {
  return {
    className: '',
    variable,
  };
}

// Phase 1 of the hosted-entry migration keeps typography offline-safe.
// We preserve the exported font contract from the reference app so pages can
// be copied across with minimal changes, then swap to local/self-hosted fonts
// later when the www surface is finalized.
export const fontNotoSans = createFontToken('--font-noto-sans');
export const fontNotoSerif = createFontToken('--font-noto-serif');
export const fontNotoSansMono = createFontToken('--font-noto-sans-mono');
export const fontBricolageGrotesque = createFontToken(
  '--font-bricolage-grotesque',
);
export const fontCommissioner = createFontToken('--font-commissioner');

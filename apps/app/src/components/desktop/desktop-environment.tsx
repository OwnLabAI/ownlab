'use client';

import { useEffect } from 'react';

export function DesktopEnvironment() {
  useEffect(() => {
    const body = document.body;
    const desktop = window.ownlabDesktop;

    if (!desktop) {
      body.removeAttribute('data-desktop');
      body.removeAttribute('data-platform');
      return;
    }

    body.dataset.desktop = 'true';
    body.dataset.platform = desktop.system.platform;

    return () => {
      body.removeAttribute('data-desktop');
      body.removeAttribute('data-platform');
    };
  }, []);

  return null;
}

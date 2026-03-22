'use client';

import { FileText, Folder } from 'lucide-react';

export function WorkspaceDefaultView() {
  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <div className="text-center max-w-lg mx-auto p-8">
        <img
          src="/logo-name.svg"
          alt="OwnLab"
          className="h-12 w-auto mx-auto mb-6"
        />
        <h1 className="text-xl font-semibold mb-2 text-foreground">
          Workspace
        </h1>
        <p className="text-muted-foreground mb-6">
          Use the sidebar to create folders and notes, or upload files. Select a
          file to view it here.
        </p>
        <div className="flex items-center justify-center gap-6 text-muted-foreground">
          <span className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            New Folder
          </span>
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            New Note
          </span>
        </div>
      </div>
    </div>
  );
}

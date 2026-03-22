'use client';

import {
  FileText,
  FileUp,
  FolderPlus,
  Loader2,
  Plus,
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createFolder, createNote } from '@/features/workspace/actions/items';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import type { Item } from '@/features/workspace/data/items';

interface NavNewProps {
  workspaceId: string;
  parentId?: string | null;
  onItemCreated?: (item: Item) => void;
}

export function NavNew({
  workspaceId,
  parentId = null,
  onItemCreated,
}: NavNewProps) {
  const [isPending, startTransition] = useTransition();
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');

  const handleNewNote = () => {
    startTransition(async () => {
      setIsCreatingNote(true);
      const result = await createNote({
        workspaceId,
        name: 'Untitled Document',
        parentId,
      });
      setIsCreatingNote(false);
      if (result?.data?.success && result.data.id) {
        const now = new Date();
        const newItem: Item = {
          id: result.data.id,
          name: 'Untitled Document',
          kind: 'note',
          parentId: parentId ?? null,
          workspaceId,
          creatorId: 'local-user',
          fileType: null,
          storageKey: null,
          url: result.data.url ?? null,
          content: null,
          createdAt: now,
          updatedAt: now,
        };
        onItemCreated?.(newItem);
        toast.success('Note created');
      } else {
        toast.error(result?.data?.error ?? 'Failed to create note');
      }
    });
  };

  const handleCreateFolder = () => {
    if (!folderName.trim()) {
      toast.error('Folder name cannot be empty.');
      return;
    }
    startTransition(async () => {
      const result = await createFolder({
        workspaceId,
        parentId,
        name: folderName.trim(),
      });
      if (result?.data?.success && result.data.id) {
        const now = new Date();
        const newItem: Item = {
          id: result.data.id,
          name: folderName.trim(),
          kind: 'folder',
          parentId: parentId ?? null,
          workspaceId,
          creatorId: 'local-user',
          fileType: null,
          storageKey: null,
          url: null,
          content: null,
          createdAt: now,
          updatedAt: now,
        };
        onItemCreated?.(newItem);
        toast.success('Folder created');
        setFolderDialogOpen(false);
        setFolderName('');
      } else {
        toast.error(result?.data?.error ?? 'Failed to create folder');
      }
    });
  };

  const handleUpload = () => {
    toast.info('File upload coming soon. Only PDF will be supported.');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          id={`workspace-new-trigger-${workspaceId}${parentId ? `-${parentId}` : '-root'}`}
          asChild
        >
          <SidebarMenuButton>
            <Plus className="h-4 w-4" />
            <span>New</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56 rounded-lg"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <DropdownMenuItem
            onClick={handleNewNote}
            className="cursor-pointer"
            disabled={isCreatingNote}
          >
            {isCreatingNote ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            <span>{isCreatingNote ? 'Creating...' : 'New Note'}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleUpload} className="cursor-pointer">
            <FileUp className="mr-2 h-4 w-4" />
            <span>Add File</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setFolderDialogOpen(true)}
            className="cursor-pointer"
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            <span>New Folder</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for the folder.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Project Documents"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFolderDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!folderName.trim() || isPending}
            >
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

'use client';

import { Trash2, X } from 'lucide-react';
import type { Channel } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChannelsPanel } from '../tool-panel/channels-panel';

interface ChannelManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: Channel;
  deleting: boolean;
  isDefaultWorkspaceChannel: boolean;
  onDelete: () => void;
}

export function ChannelManageDialog({
  open,
  onOpenChange,
  channel,
  deleting,
  isDefaultWorkspaceChannel,
  onDelete,
}: ChannelManageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[75vh] max-w-xl flex-col overflow-hidden p-0" showCloseButton={false}>
        <DialogHeader className="relative border-b px-6 py-4">
          <div className="pr-24">
            <DialogTitle>{channel.title?.trim() || channel.name}</DialogTitle>
          </div>
          <DialogDescription>Manage channel members.</DialogDescription>
          <div className="absolute top-3.5 right-4 flex items-center gap-1">
            {!isDefaultWorkspaceChannel ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={onDelete}
                    disabled={deleting}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Delete channel</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Delete channel</TooltipContent>
              </Tooltip>
            ) : null}
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" className="rounded-full">
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChannelsPanel mode="members" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

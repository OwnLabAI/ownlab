'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, FolderOpen, X } from 'lucide-react';
import { useCallback, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { browseWorkspaceFolder } from '@/lib/api';
import { createWorkspace } from '@/features/lab/actions/workspaces';

function BrowseFolderButton({
  onFolderSelected,
  disabled,
}: {
  onFolderSelected: (path: string) => void;
  disabled?: boolean;
}) {
  const handleClick = useCallback(() => {
    browseWorkspaceFolder()
      .then((result) => {
        if (!result?.path) return;
        onFolderSelected(result.path);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to open folder picker');
      });
  }, [onFolderSelected]);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleClick}
      title="Choose folder"
      disabled={disabled}
    >
      <FolderOpen className="h-4 w-4" />
    </Button>
  );
}

const formSchema = z.object({
  worktreePath: z.string().min(1, { message: 'Please choose a local folder.' }).max(500),
});

type FormData = z.infer<typeof formSchema>;

interface CreateWorkspaceDialogProps {
  trigger?: React.ReactNode;
  /** Controlled mode: when provided, dialog open state is controlled by parent */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called after workspace is created successfully (e.g. to refresh list or navigate) */
  onCreated?: (workspaceId: string) => void;
}

export function CreateWorkspaceDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onCreated,
}: CreateWorkspaceDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setDialogOpen = isControlled
    ? (controlledOnOpenChange ?? (() => {}))
    : setInternalOpen;
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { worktreePath: '' },
  });

  const selectedFolderPath = form.watch('worktreePath')?.trim() ?? '';

  const resetForm = useCallback(() => {
    form.reset({ worktreePath: '' });
  }, [form]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        resetForm();
      } else {
        resetForm();
      }
      setDialogOpen(nextOpen);
    },
    [resetForm, setDialogOpen],
  );

  const onSubmit = (values: FormData) => {
    startTransition(async () => {
      const result = await createWorkspace({
        worktreePath: values.worktreePath?.trim() || null,
      });
      const data = result?.data;
      if (data?.success) {
        toast.success(data.message);
        handleOpenChange(false);
        if (data.id) onCreated?.(data.id);
      } else if (data?.error) {
        toast.error(data.error);
      }
    });
  };

  const defaultTrigger = (
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      Create Workspace
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Choose a local folder for the workspace.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="worktreePath"
              render={() => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Workspace path
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        value={selectedFolderPath}
                        placeholder="Choose local folder"
                        className="font-mono text-sm"
                        readOnly
                      />
                      <BrowseFolderButton
                        disabled={isPending}
                        onFolderSelected={(pathHint) => {
                          form.setValue('worktreePath', pathHint);
                        }}
                      />
                      {selectedFolderPath ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title="Clear folder"
                          onClick={() => {
                            form.setValue('worktreePath', '');
                            form.clearErrors(['worktreePath']);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

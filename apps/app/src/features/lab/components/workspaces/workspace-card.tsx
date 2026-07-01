'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Edit, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { deleteWorkspace, updateWorkspace } from '@/features/lab/actions/workspaces';
import type { Workspace } from '@/features/lab/data/workspaces';

interface WorkspaceCardProps {
  workspace: Workspace;
}

const formSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Workspace name must be at least 2 characters.' })
    .max(50),
});
type FormData = z.infer<typeof formSchema>;

export function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: workspace.name },
  });

  const formattedDate = new Date(workspace.createdAt).toLocaleDateString();

  const onEditSubmit = (values: FormData) => {
    startTransition(async () => {
      const result = await updateWorkspace({
        id: workspace.id,
        name: values.name,
      });
      const data = result?.data;
      if (data?.success) {
        toast.success(data.message);
        setIsEditModalOpen(false);
      } else if (data?.error) {
        toast.error(data.error);
      }
    });
  };

  const onDelete = () => {
    if (
      !confirm(
        'Are you sure you want to delete this workspace? This action cannot be undone.'
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteWorkspace({ id: workspace.id });
      const data = result?.data;
      if (data?.success) {
        toast.success(data.message);
      } else if (data?.error) {
        toast.error(data.error);
      }
    });
  };

  return (
    <>
      <Card className="group relative h-full transition-shadow hover:shadow-lg">
        <Link href={`/workspace/${workspace.id}`} className="block h-full p-6">
          <CardTitle className="truncate text-lg" title={workspace.name}>
            {workspace.name}
          </CardTitle>
          <p className="mt-4 text-xs text-muted-foreground">
            Created on: {formattedDate}
          </p>
        </Link>
        <div className="absolute right-2 top-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => e.preventDefault()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Workspace options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-40"
              onClick={(e) => e.preventDefault()}
            >
              <DropdownMenuItem
                onSelect={() => setIsEditModalOpen(true)}
                className="cursor-pointer"
              >
                <Edit className="mr-2 h-4 w-4" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onDelete}
                className="cursor-pointer text-red-500 focus:text-red-500"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
            <DialogDescription>
              Update the name of your workspace.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onEditSubmit)}
              className="space-y-8"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace Name</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

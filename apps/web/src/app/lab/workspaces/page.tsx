import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { CreateWorkspaceDialog, WorkspaceCard, getWorkspaces } from '@/features/lab';

export default async function LabWorkspacesPage() {
  const { workspaces, error } = await getWorkspaces();

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b">
        <div className="flex flex-1 items-center gap-2 px-3">
          <SidebarTrigger />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="line-clamp-1">
                  Lab / Workspaces
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto">
            <CreateWorkspaceDialog />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        {workspaces && workspaces.length > 0 ? (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold">Your Workspaces</h2>
              <p className="text-muted-foreground">
                Select a workspace to continue or create a new one.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {workspaces.map((workspace) => (
                <WorkspaceCard key={workspace.id} workspace={workspace} />
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
            <div className="flex flex-col items-center gap-2 text-center">
              <h3 className="text-2xl font-bold tracking-tight">
                You have no workspaces
              </h3>
              <p className="text-sm text-muted-foreground">
                Get started by creating a new workspace.
              </p>
              <div className="mt-4">
                <CreateWorkspaceDialog />
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

import { ChannelChat } from '@/features/workspace/components/channel-chat';
import { getWorkspaces } from '@/features/lab/data/workspaces';

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { workspaces } = await getWorkspaces(workspaceId);
  const workspace = workspaces?.find((ws) => ws.id === workspaceId);

  return (
    <ChannelChat
      workspaceId={workspaceId}
      workspaceName={workspace?.name}
      workspaceRootPath={workspace?.worktreePath ?? null}
    />
  );
}

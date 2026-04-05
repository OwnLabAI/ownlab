/**
 * Lab feature - public API.
 * Lab is the orchestration surface: users manage workspaces and agents here.
 */

export { LabSidebar } from './components/lab-sidebar';
export { NavLab } from './components/nav-lab';
export { NavMain } from './components/nav-main';
export { NavUser } from './components/nav-user';
export { NavAgents } from './components/agents/nav-agents';
export { NavTasks } from './components/tasks/nav-tasks';

export { CreateWorkspaceDialog, WorkspaceCard } from './components/workspaces';
export { getWorkspaces } from './data/workspaces';
export type { Workspace, WorkspaceForSwitcher } from './data/workspaces';
export {
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from './actions/workspaces';

/**
 * Workspaces feature – workspace view (channels, toolpanel, file tree, default content).
 * Workspace list and CRUD are in lab feature; this feature owns items and UI.
 */

export { WorkspaceContainer, WorkspaceDefaultView, ChannelChat, ToolPanel } from './components';
export { useWorkspaceViewStore, useWorkspaceView } from './stores/use-workspace-view-store';
export { getItemsByWorkspace } from './data/items';
export type { Item } from './data/items';
export {
  createFolder,
  createNote,
  createPdfRecord,
  renameItem,
  moveItem,
  deleteItem,
} from './actions/items';

"use client";
import { ActionMenu, ActionMenuItem } from "@/simulator/components/actions/menu";
export type ScenarioAction = { label: string; run: () => void; disabled?: boolean; destructive?: boolean };
export function ActionsMenu({ label, actions }: { label: string; actions: ScenarioAction[] }) {
  return <ActionMenu label={label}>{actions.map(action => <ActionMenuItem key={action.label} disabled={action.disabled} destructive={action.destructive} onClick={action.run}>{action.label}</ActionMenuItem>)}</ActionMenu>;
}

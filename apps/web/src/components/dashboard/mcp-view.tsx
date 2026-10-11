/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { For, Show, createResource, createSignal, onCleanup } from "solid-js";
import { toast } from "somoto";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Switch as Toggle, SwitchControl, SwitchInput, SwitchThumb } from "@/components/ui/switch";
import {
  AGENT_ICONS,
  applyMcp,
  fetchMcpStatus,
  type AgentId,
  type McpAgentStatus,
} from "@/lib/mcp";
import { isDesktop } from "@/projects";
import { ProviderSettings } from './provider-settings';

import {
  DashboardDividedStack,
  DashboardInfoActionRow,
  DashboardScrollView,
  DashboardSurfaceCard,
  DashboardSurfaceSection,
  DashboardTitledSection,
} from "./shared";

const MCP_DOCS_URL = "https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers";

// --- Agents ------------------------------------------------------------------

type AgentRowProps = {
  agent: McpAgentStatus;
  /** The state the switch is moving to while a write is in flight. */
  pending: boolean | undefined;
  onChange: (connected: boolean) => void;
};

function AgentRow(props: AgentRowProps) {
  const checked = () => props.pending ?? props.agent.connected;

  return (
    <DashboardInfoActionRow
      layout="inline"
      leadingSize="sm"
      title={props.agent.label}
      leading={<Icon name={AGENT_ICONS[props.agent.id]} class="text-foreground" />}
      action={
        <Toggle
          checked={checked()}
          disabled={props.pending !== undefined || (!checked() && !!props.agent.unavailable)}
          onChange={props.onChange}
          class="flex shrink-0 items-center"
        >
          <SwitchInput aria-label={`Conectar ${props.agent.label}`} />
          <SwitchControl variant="compact">
            <SwitchThumb variant="compact" />
          </SwitchControl>
        </Toggle>
      }
    />
  );
}

function DashboardAgentsSection() {
  const [status, { refetch }] = createResource(fetchMcpStatus);
  const [pending, setPending] = createSignal<Partial<Record<AgentId, boolean>>>({});

  const agents = () => (status()?.agents ?? []).filter((agent) => agent.id === 'codex');
  const labelOf = (id: AgentId) => agents().find((agent) => agent.id === id)?.label ?? id;

  /** Every agent not yet connected. */
  const connectable = () => agents().filter((agent) => !agent.connected && !agent.unavailable);

  /**
   * Writes the change straight into the agents' configs — a switch is not a
   * draft. Whatever fails snaps back, with the reason in a toast.
   */
  const apply = async (add: AgentId[], remove: AgentId[]) => {
    if (add.length + remove.length === 0) return;
    setPending((current) => ({
      ...current,
      ...Object.fromEntries(add.map((id) => [id, true])),
      ...Object.fromEntries(remove.map((id) => [id, false])),
    }));
    try {
      const result = await applyMcp({ add, remove });
      const changed = result.added.length + result.removed.length;
      if (result.failures.length > 0) {
        toast.error(changed > 0 ? "Some agents could not be updated" : "Agents could not be updated", {
          description: result.failures.map((failure) => `${labelOf(failure.id)}: ${failure.error}`).join("\n"),
        });
      }
    } catch (e) {
      toast.error("Could not update the agents", { description: (e as Error).message });
    } finally {
      await refetch();
      setPending((current) => {
        const next = { ...current };
        for (const id of [...add, ...remove]) delete next[id];
        return next;
      });
    }
  };

  const setConnected = (agent: McpAgentStatus, connected: boolean) =>
    apply(connected ? [agent.id] : [], connected ? [] : [agent.id]);

  const enableAll = () => apply(connectable().map((agent) => agent.id), []);

  return (
    <DashboardTitledSection
      title="Herramientas para agentes externos"
      description="Compartí el editor por MCP con agentes que ejecutás fuera del chat de Syka."
      action={
        <Button variant="link" class="h-4" disabled={connectable().length === 0} onClick={enableAll}>
          Conectar todos
        </Button>
      }
    >
      <DashboardSurfaceCard class="flex flex-col gap-3">
        <Show
          when={status()}
          fallback={<p class="text-xs text-muted-foreground">Comprobando conexiones…</p>}
        >
          {(_current) => (
            <DashboardDividedStack>
              <For each={agents()}>
                {(agent) => (
                  <AgentRow
                    agent={agent}
                    pending={pending()[agent.id]}
                    onChange={(connected) => void setConnected(agent, connected)}
                  />
                )}
              </For>
            </DashboardDividedStack>
          )}
        </Show>
      </DashboardSurfaceCard>
    </DashboardTitledSection>
  );
}

// --- MCP server --------------------------------------------------------------

const COPIED_LABEL_MS = 2000;

function DashboardMcpServerSection() {
  const [status] = createResource(fetchMcpStatus);
  const [copied, setCopied] = createSignal(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copiedTimer));

  const copy = async () => {
    const url = status()?.url;
    if (!url || status()?.available === false) return;
    try {
      await navigator.clipboard.writeText(url);
      // The button itself says so for a moment, then goes back to its label.
      setCopied(true);
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => setCopied(false), COPIED_LABEL_MS);
    } catch (e) {
      toast.error("Failed to copy", { description: (e as Error).message });
    }
  };

  return (
    <DashboardTitledSection title="Servidor MCP">
      <DashboardSurfaceCard class="flex flex-col gap-3">
        <DashboardInfoActionRow
          layout="inline"
          leadingSize="sm"
          title="Syka Studio MCP"
          leading={<Icon name="ai-mcp-cli" class="text-foreground" />}
          description={status()?.error ?? "Conectá un agente externo a las herramientas de esta ventana mediante MCP."}
          action={
            <div class="flex shrink-0 items-center gap-2">
              <div class="flex h-7 w-41 items-center rounded-md bg-input px-2">
                <span class="min-w-0 flex-1 truncate text-xs text-foreground">{status()?.url ?? "..."}</span>
              </div>
              <Button variant="secondary" disabled={!status() || status()?.available === false} onClick={copy}>
                {copied() ? "¡Copiada!" : "Copiar URL"}
              </Button>
            </div>
          }
        />
      </DashboardSurfaceCard>
      <p class="px-2 pt-3 text-xs text-muted-foreground">
        <span>{status()?.available === false ? "Conexión no disponible en esta ventana. " : "Disponible localmente mientras esta instancia de Syka Studio esté abierta. "}</span>
        <a href={MCP_DOCS_URL} target="_blank" class="text-primary hover:underline">
          ¿Qué es MCP?
        </a>
      </p>
    </DashboardTitledSection>
  );
}

// --- CLI ---------------------------------------------------------------------

function DashboardCliSection() {
  return (
    <DashboardSurfaceSection
      title="CLI"
      description="Local tools are included with Syka Studio."
    >
      <DashboardInfoActionRow
        layout="inline"
        leadingSize="sm"
        title="Syka CLI"
        leading={<Icon name="dapi-cli" class="text-foreground" />}
        description="The integrated chat works without a separate CLI installation. External agents can connect through the local MCP server above."
        action={
          <span class="rounded-md bg-accent px-3 py-1.5 text-xs text-muted-foreground">Included</span>
        }
      />
    </DashboardSurfaceSection>
  );
}

export function DashboardMcpView() {
  return (
    <DashboardScrollView>
      <Show
        when={isDesktop()}
        fallback={
          <DashboardSurfaceSection title="MCP & CLI">
            <p class="text-xs text-muted-foreground">
              Local agent connections are available in the desktop app. Syka's tools are already included.
            </p>
          </DashboardSurfaceSection>
        }
      >
        <ProviderSettings />
        <DashboardAgentsSection />
        <DashboardMcpServerSection />
        <DashboardCliSection />
      </Show>
    </DashboardScrollView>
  );
}

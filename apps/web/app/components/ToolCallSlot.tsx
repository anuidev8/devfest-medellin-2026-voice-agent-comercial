"use client";

import * as CopilotKitV2 from "@copilotkit/react-core/v2";
import { UseAgentUpdate, useAgent } from "@copilotkit/react-core/v2";
import type { ComponentType } from "react";

/**
 * Public runtime export of @copilotkit/react-core/v2 (1.79.1). Its .d.mts imports two symbols under
 * this same name (component + props type), so TypeScript drops it — re-type it here.
 */
const CopilotChatToolCallsView = (
  CopilotKitV2 as unknown as {
    CopilotChatToolCallsView: ComponentType<{ message: unknown; messages?: unknown[] }>;
  }
).CopilotChatToolCallsView;

type ToolCall = { id: string; type?: string; function: { name: string; arguments: string } };
type Msg = { id: string; role: string; toolCalls?: ToolCall[]; toolCallId?: string; content?: unknown };

/**
 * Renders the latest `name` tool call on the board with the renderer registered via
 * CopilotKit `useRenderTool` — the same registry and status flow (inProgress → executing →
 * complete) the chat uses. Uses CopilotKit's public CopilotChatToolCallsView with an
 * assistant message narrowed to that one call; `messages` lets it find the tool result.
 */
export function ToolCallSlot({ name, fallback = null }: { name: string; fallback?: React.ReactNode }) {
  const { agent } = useAgent({ agentId: "default", updates: [UseAgentUpdate.OnMessagesChanged] });
  const narrowed = latestCall((agent.messages ?? []) as Msg[], name);

  if (!narrowed) return <>{fallback}</>;
  return <CopilotChatToolCallsView message={narrowed} messages={agent.messages} />;
}

/** Assistant message narrowed to its latest `name` tool call (cheap reverse scan). */
function latestCall(msgs: Msg[], name: string) {
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]!;
    const call = m.toolCalls?.findLast((c) => c.function?.name === name);
    if (call) return { ...m, toolCalls: [call] };
  }
  return null;
}

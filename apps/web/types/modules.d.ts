// Type shims: @copilotkit/react-core@1.79 "./v2" export ships only
// index.d.cts (no .d.mts / "types" condition), so TS "bundler" resolution
// cannot find it, and @livekit/components-react ships .d.ts.map without
// the .d.ts in this install. These declare the exact surface we use.
declare module "@copilotkit/react-core/v2" {
  import type { ComponentType, ReactElement, ReactNode } from "react";
  import type { ZodObject, ZodRawShape } from "zod";

  export const CopilotKit: ComponentType<{
    runtimeUrl?: string;
    useSingleEndpoint?: boolean;
    agent?: string;
    a2ui?: boolean | { theme?: unknown; catalog?: unknown };
    children?: ReactNode;
  }>;
  export const CopilotChat: ComponentType<{ agentId?: string; labels?: Record<string, string> }>;

  export enum ToolCallStatus {
    InProgress = "inProgress",
    Executing = "executing",
    Complete = "complete",
  }

  export type RenderToolStatus = "inProgress" | "executing" | "complete" | string;
  export function useRenderTool(config: {
    name: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: (props: { name: string; status: RenderToolStatus; args?: any; result?: any }) => ReactNode;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parameters?: ZodObject<ZodRawShape> | any;
  }): void;

  export function useFrontendTool<T extends ZodRawShape>(config: {
    name: string;
    description: string;
    parameters: ZodObject<T>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: any) => Promise<string> | string;
  }): void;

  export function useHumanInTheLoop<T extends ZodRawShape>(
    config: {
      name: string;
      description: string;
      parameters: ZodObject<T>;
      // Component preferred — CopilotKit calls React.createElement(render, props)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: ComponentType<any> | ((props: any) => ReactNode);
    },
    deps?: ReadonlyArray<unknown>,
  ): void;

  export function useRenderActivityMessage(): {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderActivityMessage: (message: any) => ReactElement | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findRenderer: (activityType: string) => any;
  };

  // Headless agent access (voice-first stage, chat optional)
  export enum UseAgentUpdate {
    OnMessagesChanged = "OnMessagesChanged",
    OnStateChanged = "OnStateChanged",
    OnRunStatusChanged = "OnRunStatusChanged",
  }
  export type AgentMessage = {
    id: string;
    role: string;
    content?: unknown;
    toolCalls?: unknown[];
    toolCallId?: string;
    activityType?: string;
  };
  export interface Agent {
    messages: AgentMessage[];
    isRunning: boolean;
    addMessage(message: { id: string; role: "user"; content: string }): void;
  }
  export function useAgent(props?: { agentId?: string; updates?: UseAgentUpdate[]; throttleMs?: number }): { agent: Agent; isReady: boolean };
  export function useCopilotKit(): { copilotkit: { runAgent(params: { agent: Agent }): Promise<unknown> } };
}

declare module "@livekit/components-react" {
  import type { ComponentType, ReactNode } from "react";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const LiveKitRoom: ComponentType<any & { children?: ReactNode }>;
  export const RoomAudioRenderer: ComponentType<Record<string, never>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const ControlBar: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const BarVisualizer: ComponentType<any>;
  // Full LiveKit Room; narrowed surface is still available via casting when needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useRoomContext(): any;
  export function useVoiceAssistant(): {
    agent: unknown;
    state: string;
    audioTrack: unknown;
    videoTrack?: unknown;
    agentTranscriptions?: unknown[];
    agentAttributes?: Record<string, string>;
  };
}

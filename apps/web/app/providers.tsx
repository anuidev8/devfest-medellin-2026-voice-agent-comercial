"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { conciergeCatalog } from "./a2ui/catalog";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // Catalog = basic primitives (plan Composer surface) + CommunityBoard.
    // Bridge emits ACTIVITY_SNAPSHOT a2ui-surface for plan and focused match.
    <CopilotKit runtimeUrl="/api/copilotkit" useSingleEndpoint={false} a2ui={{ catalog: conciergeCatalog }}>
      {children}
    </CopilotKit>
  );
}

export function parseToolResult<T>(result: unknown): T | null {
  if (!result) return null;
  if (typeof result === "string") {
    try {
      return JSON.parse(result) as T;
    } catch {
      return null;
    }
  }
  return result as T;
}

export const isDone = (status: unknown) => status === "complete" || status === "completed" || status === "finished";

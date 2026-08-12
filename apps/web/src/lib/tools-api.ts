import { API_BASE_URL } from '@/lib/api';
import type { ToolDefinition } from '@/types/chat';

export async function listTools(): Promise<ToolDefinition[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/tools`);
  if (!res.ok) {
    throw new Error(`Failed to list tools (status ${res.status})`);
  }
  const data = (await res.json()) as { tools: ToolDefinition[] };
  return data.tools;
}

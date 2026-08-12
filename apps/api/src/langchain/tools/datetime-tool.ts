import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import type { RegisteredTool } from './tool.types.js';

const NAME = 'get_current_datetime';
const DESCRIPTION =
  'Gets the current date and time, optionally in a specific IANA timezone (e.g. "America/New_York"). Defaults to UTC.';

const schema = z.object({
  timezone: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('An IANA timezone name, e.g. "America/New_York" or "Asia/Tokyo". Defaults to UTC.'),
});

type DatetimeArgs = z.infer<typeof schema>;

/**
 * The concrete answer to the roadmap's "Custom tools" item — everything
 * needed to plug a brand-new tool into this framework is right here:
 * an `execute()` function, a zod schema, a name/description, registered in
 * `tool-registry.ts`. Nothing about the other four tools is special-cased
 * (§2 of docs/phases/phase-5-tools.md).
 */
async function execute({
  timezone,
}: DatetimeArgs): Promise<{ timezone: string; datetime: string; iso: string }> {
  const tz = timezone ?? 'UTC';
  const now = new Date();

  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(now);
  } catch {
    throw new Error(
      `Unknown timezone "${tz}". Use an IANA timezone name, e.g. "America/New_York".`,
    );
  }

  return { timezone: tz, datetime: formatted, iso: now.toISOString() };
}

export function createDatetimeTool(): RegisteredTool {
  return {
    name: NAME,
    description: DESCRIPTION,
    schema,
    execute,
    structuredTool: tool(execute, { name: NAME, description: DESCRIPTION, schema }),
  } as unknown as RegisteredTool;
}

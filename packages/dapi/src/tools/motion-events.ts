import { z } from 'zod';
import { defineTool } from '../tool';

export const motionEvents = defineTool({
  name: 'motion_events', title: 'Native motion events', environment: 'renderer',
  description: 'Resolve named motion events within a Diffusion scene (active scene or id). Element is an authored id or full Source stamp; start/end are native trimmed boundaries in the composition clock. Re-query after timing edits. Returns unresolved anchors rather than guessed times. Use the same IDs for audio and review. exportStartSeconds is the current workarea start; subtract it for frame times in a default workarea export, and account for any different export trim explicitly.',
  input: z.object({ id: z.string().optional(), events: z.array(z.object({ id: z.string().min(1), element: z.string().min(1),
    edge: z.enum(['start', 'end']), offsetSeconds: z.number().finite().optional() }).strict()).min(1).max(64) }).strict(),
  output: z.object({ projectDir: z.string(), composition: z.string().nullable(), frameRate: z.number(), exportStartSeconds: z.number(), events: z.array(z.object({ id: z.string(), element: z.string(),
    edge: z.enum(['start', 'end']), offsetSeconds: z.number().optional(), status: z.enum(['resolved', 'unresolved']),
    seconds: z.number().nullable(), reason: z.string().nullable() })) }),
});

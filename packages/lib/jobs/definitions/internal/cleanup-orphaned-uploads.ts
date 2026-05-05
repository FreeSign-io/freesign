import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const CLEANUP_ORPHANED_UPLOADS_JOB_DEFINITION_ID = 'internal.cleanup-orphaned-uploads';

const CLEANUP_ORPHANED_UPLOADS_JOB_DEFINITION_SCHEMA = z.object({});

export type TCleanupOrphanedUploadsJobDefinition = z.infer<
  typeof CLEANUP_ORPHANED_UPLOADS_JOB_DEFINITION_SCHEMA
>;

export const CLEANUP_ORPHANED_UPLOADS_JOB_DEFINITION = {
  id: CLEANUP_ORPHANED_UPLOADS_JOB_DEFINITION_ID,
  name: 'Cleanup Orphaned Uploads',
  version: '1.0.0',
  trigger: {
    name: CLEANUP_ORPHANED_UPLOADS_JOB_DEFINITION_ID,
    schema: CLEANUP_ORPHANED_UPLOADS_JOB_DEFINITION_SCHEMA,
    cron: '0 3 * * *', // Daily at 03:00 UTC.
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./cleanup-orphaned-uploads.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof CLEANUP_ORPHANED_UPLOADS_JOB_DEFINITION_ID,
  TCleanupOrphanedUploadsJobDefinition
>;

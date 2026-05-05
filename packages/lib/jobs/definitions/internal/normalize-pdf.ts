import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const NORMALIZE_PDF_JOB_DEFINITION_ID = 'internal.normalize-pdf';

const NORMALIZE_PDF_JOB_DEFINITION_SCHEMA = z.object({
  documentDataId: z.string().min(1),
});

export type TNormalizePdfJobDefinition = z.infer<typeof NORMALIZE_PDF_JOB_DEFINITION_SCHEMA>;

export const NORMALIZE_PDF_JOB_DEFINITION = {
  id: NORMALIZE_PDF_JOB_DEFINITION_ID,
  name: 'Normalize PDF',
  version: '1.0.0',
  trigger: {
    name: NORMALIZE_PDF_JOB_DEFINITION_ID,
    schema: NORMALIZE_PDF_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./normalize-pdf.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof NORMALIZE_PDF_JOB_DEFINITION_ID,
  TNormalizePdfJobDefinition
>;

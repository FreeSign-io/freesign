import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

import { prisma } from '@documenso/prisma';

import { deleteS3File } from '../../../universal/upload/server-actions';
import { env } from '../../../utils/env';
import { type JobRunIO } from '../../client/_internal/job';
import { type TCleanupOrphanedUploadsJobDefinition } from './cleanup-orphaned-uploads';

const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

const buildClient = () => {
  const region = env('NEXT_PRIVATE_UPLOAD_REGION') || 'us-east-1';
  const endpoint = env('NEXT_PRIVATE_UPLOAD_ENDPOINT');
  const accessKeyId = env('NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID');
  const secretAccessKey = env('NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY');
  const forcePathStyle = env('NEXT_PRIVATE_UPLOAD_FORCE_PATH_STYLE') === 'true';

  return new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  });
};

export const run = async ({
  payload: _payload,
  io: _io,
}: {
  payload: TCleanupOrphanedUploadsJobDefinition;
  io: JobRunIO;
}) => {
  const bucket = env('NEXT_PRIVATE_UPLOAD_BUCKET');
  if (!bucket) {
    return;
  }

  const client = buildClient();
  const cutoff = new Date(Date.now() - ORPHAN_AGE_MS);

  let continuationToken: string | undefined;
  let deleted = 0;

  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    const candidates = (listed.Contents ?? [])
      .filter((obj) => obj.Key && obj.LastModified && obj.LastModified < cutoff)
      .map((obj) => obj.Key!);

    if (candidates.length > 0) {
      const referenced = await prisma.documentData.findMany({
        where: { type: 'S3_PATH', data: { in: candidates } },
        select: { data: true },
      });
      const referencedSet = new Set(referenced.map((r) => r.data));

      const orphans = candidates.filter((k) => !referencedSet.has(k));

      for (const key of orphans) {
        try {
          await deleteS3File(key);
          deleted++;
        } catch {
          // Best-effort; will retry next run.
        }
      }
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  // eslint-disable-next-line no-console
  console.log(`[cleanup-orphaned-uploads] deleted ${deleted} orphan object(s) older than 24h`);
};

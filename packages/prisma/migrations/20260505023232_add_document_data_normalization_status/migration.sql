-- Tracks whether a DocumentData row has been normalized (flatten layers/forms
-- via pdf-lib). Existing rows were normalized synchronously at upload time, so
-- they default to `complete`. New direct-to-S3 uploads insert `pending` and
-- the internal.normalizePdf BullMQ job sets `complete` (or `failed`) once it
-- finishes.

CREATE TYPE "DocumentDataNormalizationStatus" AS ENUM ('pending', 'complete', 'failed');

ALTER TABLE "DocumentData"
  ADD COLUMN "normalizationStatus" "DocumentDataNormalizationStatus" NOT NULL DEFAULT 'complete';

import * as fs from 'node:fs';

import { env } from '@documenso/lib/utils/env';

export const getCertificateStatus = () => {
  if (env('NEXT_PRIVATE_SIGNING_TRANSPORT') !== 'local') {
    return { isAvailable: true };
  }

  if (env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS')) {
    return { isAvailable: true };
  }

  // Try paths in order: env override -> /opt/freesign (new) -> /opt/documenso (legacy).
  // Self-host installs from before the rebrand still mount the cert at the old
  // path; keep accepting both so they don't have to migrate to deploy.
  const candidatePaths = [
    env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH'),
    env('NODE_ENV') === 'production' ? '/opt/freesign/cert.p12' : null,
    env('NODE_ENV') === 'production' ? '/opt/documenso/cert.p12' : './example/cert.p12',
  ].filter((p): p is string => Boolean(p));

  for (const filePath of candidatePaths) {
    try {
      fs.accessSync(filePath, fs.constants.F_OK | fs.constants.R_OK);

      const stats = fs.statSync(filePath);

      if (stats.size > 0) {
        return { isAvailable: true };
      }
    } catch {
      // Try the next candidate.
    }
  }

  return { isAvailable: false };
};

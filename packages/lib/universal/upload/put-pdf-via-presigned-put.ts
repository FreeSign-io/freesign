import type { TGetPresignedPutUrlResponse } from '../../../../apps/remix/server/api/files/files.types';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { AppError } from '../../errors/app-error';

/**
 * Browser-side direct-to-Spaces upload of a PDF.
 *
 * 1. Asks the server for a presigned PUT URL with a Content-Length policy
 *    matching `file.size`. The server enforces APP_DOCUMENT_UPLOAD_SIZE_LIMIT
 *    here so we cannot trick it by lying about size client-side.
 * 2. PUTs the body directly to DigitalOcean Spaces — never through the
 *    FreeSign server. Reports progress via XHR upload events.
 * 3. Returns the storage key, which the caller passes to
 *    `envelope.createFromKeys` to actually create the envelope.
 */
export const putPdfFileViaPresignedPut = async (
  file: File,
  options: { onProgress?: (loaded: number, total: number) => void } = {},
): Promise<{ key: string; fileSize: number; fileName: string }> => {
  if (file.type !== 'application/pdf') {
    throw new AppError('INVALID_DOCUMENT_FILE', {
      message: 'Only PDF files are supported',
    });
  }

  const presignResponse = await fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/api/files/presigned-put-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
    }),
  });

  if (!presignResponse.ok) {
    if (presignResponse.status === 413) {
      throw new AppError('FILE_TOO_LARGE');
    }
    throw new AppError('PRESIGN_FAILED', {
      message: `Failed to get presigned URL (status ${presignResponse.status})`,
    });
  }

  const { key, url }: TGetPresignedPutUrlResponse = await presignResponse.json();

  // XHR rather than fetch so we can surface upload progress.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type);

    if (options.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          options.onProgress!(e.loaded, e.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new AppError('UPLOAD_FAILED', {
            message: `Upload to storage failed (status ${xhr.status})`,
          }),
        );
      }
    };
    xhr.onerror = () => reject(new AppError('UPLOAD_FAILED', { message: 'Network error' }));
    xhr.send(file);
  });

  return { key, fileSize: file.size, fileName: file.name };
};

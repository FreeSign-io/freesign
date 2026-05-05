import { SigningStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type GetCompletedFieldsForDocumentOptions = {
  envelopeId: string;
};

export const getCompletedFieldsForDocument = async ({
  envelopeId,
}: GetCompletedFieldsForDocumentOptions) => {
  return await prisma.field.findMany({
    where: {
      envelopeId,
      recipient: {
        signingStatus: SigningStatus.SIGNED,
      },
      inserted: true,
    },
    include: {
      signature: true,
      recipient: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
};

import { getInvoices } from '@documenso/ee/server-only/stripe/get-invoices';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

export interface FindTeamInvoicesOptions {
  userId: number;
  teamId: number;
}

export const findOrganisationInvoices = async ({ userId, teamId }: FindTeamInvoicesOptions) => {
  const team = await prisma.team.findUniqueOrThrow({
    where: {
      id: teamId,
      organisation: {
        members: {
          some: {
            userId,
            organisationGroupMembers: {
              some: {
                group: {
                  organisationRole: {
                    in: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
                  },
                },
              },
            },
          },
        },
      },
    },
    include: {
      organisation: {
        include: {
          subscription: true,
        },
      },
    },
  });

  const customerId = team.organisation.subscription?.customerId;

  if (!customerId) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team has no customer ID.',
    });
  }

  const results = await getInvoices({ customerId });

  if (!results) {
    return null;
  }

  return {
    ...results,
    data: results.data.map((invoice) => ({
      invoicePdf: invoice.invoice_pdf,
      hostedInvoicePdf: invoice.hosted_invoice_url,
      status: invoice.status,
      subtotal: invoice.subtotal,
      total: invoice.total,
      amountPaid: invoice.amount_paid,
      amountDue: invoice.amount_due,
      created: invoice.created,
      paid: invoice.paid,
      quantity: invoice.lines.data[0].quantity ?? 0,
      currency: invoice.currency,
    })),
  };
};

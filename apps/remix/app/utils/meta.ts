import { type MessageDescriptor, i18n } from '@lingui/core';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

export const appMetaTags = (title?: MessageDescriptor) => {
  const description =
    'FreeSign is an open-source eSignature platform for individuals and teams who do not want to pay a recurring subscription to sign the occasional contract. Legally binding, fully featured, and free for everyone.';

  return [
    {
      title: title ? `${i18n._(title)} - FreeSign` : 'FreeSign',
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content:
        'FreeSign, open source, DocuSign alternative, eSignature, document signing, free, no subscription, AGPL, self-hosted',
    },
    {
      name: 'author',
      content: 'FreeSign',
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: 'FreeSign - Open-Source eSignature, Without the Subscription',
    },
    {
      property: 'og:description',
      content: description,
    },
    {
      property: 'og:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:description',
      content: description,
    },
    {
      name: 'twitter:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
  ];
};

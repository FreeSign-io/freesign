import type { Page } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

type LoginOptions = {
  page: Page;
  email?: string;
  password?: string;

  /**
   * Where to navigate after login.
   */
  redirectPath?: string;
};

export const apiSignin = async ({
  page,
  email = 'example@freesign.com',
  password = 'password',
  redirectPath = '/',
}: LoginOptions) => {
  const { request } = page.context();

  const csrfToken = await getCsrfToken(page);

  await request.post(`${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/email-password/authorize`, {
    data: {
      email,
      password,
      csrfToken,
    },
  });

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}${redirectPath}`);
  await page.waitForTimeout(500);
};

export const apiSignout = async ({ page }: { page: Page }) => {
  const { request } = page.context();

  await request.post(`${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/signout`);

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/signin`);
};

const getCsrfToken = async (page: Page) => {
  const { request } = page.context();

  // The CSRF endpoint occasionally drops the connection under CI load
  // ("socket hang up") which then poisons the entire signin flow. Retry
  // a couple of times before giving up - the request itself is idempotent.
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request.fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/csrf`, {
        method: 'get',
      });

      const { csrfToken } = await response.json();

      if (!csrfToken) {
        throw new Error('Invalid session');
      }

      return csrfToken;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(500 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to fetch CSRF token');
};

export const checkSessionValid = async (page: Page): Promise<boolean> => {
  const { request } = page.context();

  const response = await request.fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/session`, {
    method: 'get',
  });

  const session = await response.json();

  return session.isAuthenticated === true;
};

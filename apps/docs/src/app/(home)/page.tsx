import type { Metadata } from 'next';
import Link from 'next/link';

import {
  BookOpenIcon,
  CodeIcon,
  FileTextIcon,
  GithubIcon,
  ServerIcon,
  ShieldCheckIcon,
  UserIcon,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'FreeSign Docs',
  description:
    'The official documentation for FreeSign, the open-source document signing platform. Send documents for signatures, integrate with the API, or self-host with full control.',
};

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      {/* Hero */}
      <div className="mb-16 pt-6 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">FreeSign Documentation</h1>
        <p className="text-fd-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
          The open-source document signing platform. Send documents for signatures, integrate with
          your apps, or self-host with full control.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/docs/users"
            className="bg-documenso text-fd-primary-foreground hover:bg-documenso-dark/90 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/FreeSign-io/freesign"
            className="bg-fd-background hover:bg-fd-accent inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
          >
            <GithubIcon className="size-4" />
            View on GitHub
          </a>
        </div>
      </div>

      {/* Main Guide Cards */}
      <div className="mb-16 grid gap-4 md:grid-cols-3">
        <Link
          href="/docs/users"
          className="group bg-fd-card hover:border-fd-primary/50 relative flex flex-col rounded-xl border p-6 transition-all hover:shadow-md"
        >
          <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <UserIcon className="size-6" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">User Guide</h2>
          <p className="text-fd-muted-foreground mb-4 flex-1 text-sm">
            Send documents, create templates, and manage your team using the web application.
          </p>
          <span className="text-fd-primary text-sm font-medium">Get started →</span>
        </Link>

        <Link
          href="/docs/developers"
          className="group bg-fd-card hover:border-fd-primary/50 relative flex flex-col rounded-xl border p-6 transition-all hover:shadow-md"
        >
          <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <CodeIcon className="size-6" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">Developer Guide</h2>
          <p className="text-fd-muted-foreground mb-4 flex-1 text-sm">
            Integrate document signing into your applications with the REST API, webhooks, and
            embedding.
          </p>
          <span className="text-fd-primary text-sm font-medium">View API docs →</span>
        </Link>

        <Link
          href="/docs/self-hosting"
          className="group bg-fd-card hover:border-fd-primary/50 relative flex flex-col rounded-xl border p-6 transition-all hover:shadow-md"
        >
          <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <ServerIcon className="size-6" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">Self-Hosting Guide</h2>
          <p className="text-fd-muted-foreground mb-4 flex-1 text-sm">
            Deploy your own FreeSign instance with Docker, Kubernetes, or Railway.
          </p>
          <span className="text-fd-primary text-sm font-medium">Deploy now →</span>
        </Link>
      </div>

      {/* Quick Start & Core Concepts */}
      <div className="mb-16 grid gap-8 md:grid-cols-2">
        <div className="bg-fd-card/50 rounded-xl border p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <BookOpenIcon className="text-fd-muted-foreground size-5" />
            Quick Start
          </h3>
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-medium">Send your first document</h4>
              <ol className="text-fd-muted-foreground list-inside list-decimal space-y-1 text-sm">
                <li>
                  <Link
                    href="/docs/users/getting-started/create-account"
                    className="text-fd-primary hover:underline"
                  >
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/users/getting-started/send-first-document"
                    className="text-fd-primary hover:underline"
                  >
                    Upload and send a document
                  </Link>
                </li>
              </ol>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium">Integrate with the API</h4>
              <ol className="text-fd-muted-foreground list-inside list-decimal space-y-1 text-sm">
                <li>
                  <Link
                    href="/docs/developers/getting-started/authentication"
                    className="text-fd-primary hover:underline"
                  >
                    Get your API key
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/developers/getting-started/first-api-call"
                    className="text-fd-primary hover:underline"
                  >
                    Make your first API call
                  </Link>
                </li>
              </ol>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium">Deploy self-hosted</h4>
              <ol className="text-fd-muted-foreground list-inside list-decimal space-y-1 text-sm">
                <li>
                  <Link
                    href="/docs/self-hosting/getting-started/requirements"
                    className="text-fd-primary hover:underline"
                  >
                    Check requirements
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/self-hosting/getting-started/quick-start"
                    className="text-fd-primary hover:underline"
                  >
                    Run with Docker
                  </Link>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="bg-fd-card/50 rounded-xl border p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <BookOpenIcon className="text-fd-muted-foreground size-5" />
            Core Concepts
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/docs/concepts/document-lifecycle"
              className="bg-fd-background hover:border-fd-primary/50 rounded-lg border p-3 text-sm transition-colors"
            >
              <div className="mb-1 font-medium">Document Lifecycle</div>
              <div className="text-fd-muted-foreground text-xs">Draft to completed</div>
            </Link>
            <Link
              href="/docs/concepts/recipient-roles"
              className="bg-fd-background hover:border-fd-primary/50 rounded-lg border p-3 text-sm transition-colors"
            >
              <div className="mb-1 font-medium">Recipient Roles</div>
              <div className="text-fd-muted-foreground text-xs">Signers and approvers</div>
            </Link>
            <Link
              href="/docs/concepts/field-types"
              className="bg-fd-background hover:border-fd-primary/50 rounded-lg border p-3 text-sm transition-colors"
            >
              <div className="mb-1 font-medium">Field Types</div>
              <div className="text-fd-muted-foreground text-xs">Signatures and inputs</div>
            </Link>
            <Link
              href="/docs/concepts/signing-certificates"
              className="bg-fd-background hover:border-fd-primary/50 rounded-lg border p-3 text-sm transition-colors"
            >
              <div className="mb-1 font-medium">Signing Certificates</div>
              <div className="text-fd-muted-foreground text-xs">Digital verification</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Compliance & Policies */}
      <div className="mb-16 grid gap-4 md:grid-cols-2">
        <Link
          href="/docs/compliance"
          className="bg-fd-card/50 hover:border-fd-primary/50 flex items-start gap-4 rounded-xl border p-5 transition-all"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldCheckIcon className="size-5" />
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Compliance & Legal</h3>
            <p className="text-fd-muted-foreground text-sm">
              ESIGN, UETA, eIDAS compliance, GDPR, and signature levels explained.
            </p>
          </div>
        </Link>

        <Link
          href="/docs/policies"
          className="bg-fd-card/50 hover:border-fd-primary/50 flex items-start gap-4 rounded-xl border p-5 transition-all"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400">
            <FileTextIcon className="size-5" />
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Policies & Licensing</h3>
            <p className="text-fd-muted-foreground text-sm">
              AGPL and Enterprise licenses, fair use, privacy policy, and support.
            </p>
          </div>
        </Link>
      </div>

      {/* Community CTA */}
      <div className="from-fd-primary/5 to-fd-primary/10 rounded-xl border bg-gradient-to-r p-8 text-center">
        <h3 className="mb-2 text-lg font-semibold">Open Source</h3>
        <p className="text-fd-muted-foreground mb-6 text-sm">
          FreeSign is open source. Contribute, ask questions, or share feedback on GitHub.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://github.com/FreeSign-io/freesign"
            className="bg-fd-background hover:bg-fd-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
          >
            <GithubIcon className="size-4" />
            GitHub
          </a>
        </div>
      </div>
    </main>
  );
}

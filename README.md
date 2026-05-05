# FreeSign

The Open Source DocuSign Alternative.

[Issues](https://github.com/FreeSign-io/freesign/issues)

[![License](https://img.shields.io/badge/license-AGPLv3-purple)](https://github.com/FreeSign-io/freesign/blob/main/LICENSE)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

## About FreeSign

Signing documents digitally should be fast and easy and should be the best practice for every document signed worldwide. FreeSign is an open-source signing tool you can self-host and audit end-to-end, so trust in your document signing pipeline isn't outsourced to a black-box vendor.

## Tech Stack

- [TypeScript](https://www.typescriptlang.org/) - Language
- [React Router](https://reactrouter.com/) - Framework
- [Prisma](https://www.prisma.io/) - ORM
- [Tailwind](https://tailwindcss.com/) - CSS
- [shadcn/ui](https://ui.shadcn.com/) - Component Library
- [react-email](https://react.email/) - Email Templates
- [tRPC](https://trpc.io/) - API
- [React-PDF](https://github.com/wojtekmaj/react-pdf) - Viewing PDFs
- [PDF-Lib](https://github.com/Hopding/pdf-lib) - PDF manipulation
- [Stripe](https://stripe.com/) - Payments

## Local Development

### Requirements

- Node.js (v22 or above)
- Postgres SQL Database
- Docker (optional)

### Developer Quickstart

> **Note**: This assumes that you have both [docker](https://docs.docker.com/get-docker/) and [docker-compose](https://docs.docker.com/compose/) installed on your machine.

1. [Fork this repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/about-forks) to your GitHub account, then clone it locally:

   ```sh
   git clone https://github.com/<your-username>/freesign
   ```

2. Set up your `.env` file using the recommendations in `.env.example`. Or just run `cp .env.example .env` to start with handpicked defaults.

3. Run `npm run dx` in the root directory to spin up a postgres database and inbucket mailserver in a docker container.

4. Run `npm run dev` in the root directory.

   Or use the shorthand: `npm run d`.

#### Access Points

1. **App** - http://localhost:3000
2. **Incoming Mail Access** - http://localhost:9000
3. **Database** - port 54320
4. **S3 Storage Dashboard** - http://localhost:9001

### Manual Setup

1. Fork and clone the repo, as above.
2. `npm i`
3. `cp .env.example .env`
4. Set the required environment variables:
   - `NEXTAUTH_SECRET`
   - `NEXT_PUBLIC_WEBAPP_URL`
   - `NEXT_PRIVATE_DATABASE_URL`
   - `NEXT_PRIVATE_DIRECT_DATABASE_URL`
   - `NEXT_PRIVATE_SMTP_FROM_NAME`
   - `NEXT_PRIVATE_SMTP_FROM_ADDRESS`
5. `npm run prisma:migrate-dev`
6. `npm run translate:compile`
7. `npm run dev`
8. Register a new user at http://localhost:3000/signup.

Optional:
- Seed the database with `npm run prisma:seed -w @documenso/prisma` to create a test user and document.
- Create your own signing certificate. See [SIGNING.md](./SIGNING.md).
- Configure a job provider for document reminders. The default local job provider does not support scheduled jobs. To enable reminders, set `NEXT_PRIVATE_JOBS_PROVIDER=inngest` and provide `NEXT_PRIVATE_INNGEST_EVENT_KEY` in your `.env`.

## Docker

A Docker image is published to GitHub Container Registry:

- `ghcr.io/freesign-io/freesign`

Pull and run with your preferred container hosting provider, providing environment variables for the database, mailserver, and so on. See the [Docker README](./docker/README.md) for detailed instructions.

## Self-Hosting

### Fetch, configure, build

```sh
git clone https://github.com/FreeSign-io/freesign.git
cd freesign
cp .env.example .env
```

The following environment variables must be set:

- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_WEBAPP_URL`
- `NEXT_PRIVATE_DATABASE_URL`
- `NEXT_PRIVATE_DIRECT_DATABASE_URL`
- `NEXT_PRIVATE_SMTP_FROM_NAME`
- `NEXT_PRIVATE_SMTP_FROM_ADDRESS`

> If you run FreeSign behind a reverse proxy, set `NEXT_PUBLIC_WEBAPP_URL` to the public URL.

Install and build:

```sh
npm i
npm run build
npm run prisma:migrate-deploy
```

Start the server:

```sh
cd apps/remix
npm run start
```

This serves on `localhost:3000`. Pair with a reverse proxy for SSL termination. To run on another port, use `next -p <PORT>` from `apps/remix`.

### Run as a systemd service

```ini
[Unit]
Description=freesign
After=network.target

[Service]
Environment=PATH=/path/to/your/node/binaries
Type=simple
User=www-data
WorkingDirectory=/var/www/freesign/apps/remix
ExecStart=/usr/bin/next start -p 3500
TimeoutSec=15
Restart=always

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

### I'm not receiving any emails when using the developer quickstart.

The dev quickstart starts an [Inbucket](https://inbucket.org/) server in a docker container that captures all outgoing email locally. Web UI: http://localhost:9000. SMTP port: 2500.

### Support IPv6

If you are deploying to a cluster that uses only IPv6, pass `-H ::` to the start command:

```sh
docker run -it freesign:latest npm run start -- -H ::
```

For k8s or docker-compose:

```yaml
containers:
  - name: freesign
    image: freesign:latest
    imagePullPolicy: IfNotPresent
    command:
      - npm
    args:
      - run
      - start
      - --
      - -H
      - '::'
```

### I can't see environment variables in my package scripts.

Wrap the script with `with:env`:

```sh
npm run with:env -- npm run myscript
```

For npx:

```sh
npm run with:env -- npx myscript
```

This loads variables from your `.env` and `.env.local`.

## Contributing

See the [contribution guide](./CONTRIBUTING.md).

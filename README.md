# Participate Budget App

This app allows users to create their own Philadelphia budget. More documentation (hopefully) coming soon.

## Local dev

To run locally, first you need a running Postgres URL. This project uses Prisma. You can create a free database in Prisma by going to the site https://www.prisma.io, clicking "Get started" and creating a Postgres database.

You can also use a local database as well.

Once you have a database, copy the example env file to `.env`:

```bash

cp .env.example .env

```

Add your database url to the `DATABASE_URL=` variable.

Generate the local Prisma config files:

```bash

npm run db:generate

```

Start the dev server:


```bash

npm run dev

```

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - run linting
- `npm run format` - run prettier and fix
- `npm run format:check` - run prettier check 
- `npm run test` - run tests
- `npm run db:view` - run the prisma studio 
- `npm run db:generate` - generate db config and schema files 
- `npm run db:migrate` - run db migrations
- `npm run db:seed` - seed current database

## Prisma

Prisma setup is scaffolded automatically in:

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/lib/prisma.ts`
- `prisma.config.ts`
- `prisma.compute.ts`
- `src/generated/prisma`


# Contributing to syncify

Thanks for your interest in contributing! Here's how to get started.

## Development setup

1. **Node.js** `v20.20.0` — use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to manage versions.

2. Enable corepack and install dependencies:
   ```sh
   corepack enable
   corepack prepare pnpm@9.15.0 --activate
   pnpm install
   ```

3. Copy the env file:
   ```sh
   cp apps/web/.env.example apps/web/.env.local
   ```
   Fill in your Spotify and TIDAL OAuth credentials. See `.env.example` for all available variables.

## Running locally

```sh
pnpm dev        # Start the dev server
pnpm test       # Run tests
pnpm typecheck  # Type-check all packages
pnpm lint       # Lint all packages
pnpm build      # Production build
```

## Code style

- **TypeScript** with strict mode enabled
- **Tailwind CSS 4** for styling
- No additional linter config beyond what ships with Next.js

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your changes and ensure `pnpm typecheck` and `pnpm test` pass.
3. Write a clear PR description explaining what changed and why.
4. Keep PRs focused — one feature or fix per PR.

## Reporting issues

Open a GitHub issue with steps to reproduce. Include browser/OS info if it's a UI bug.

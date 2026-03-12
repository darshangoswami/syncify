# syncify

Transfer your music library between streaming services.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## What it does

syncify reads your playlists and liked songs from one streaming service (currently Spotify) and recreates them on another (currently TIDAL). It matches tracks by name, artist, and album, previews matches before transferring, and creates playlists on the destination service.

## Features

- OAuth-based login to Spotify and TIDAL
- Reads playlists and liked songs from Spotify
- Fuzzy track matching across services
- Preview matched/unmatched tracks before transferring
- Creates playlists and adds tracks on TIDAL
- Invite-gated access with email approval flow
- Rate limiting and abuse prevention

## Project structure

```
apps/web          Next.js full-stack app (TypeScript)
packages/shared   Shared types and interfaces
```

## Quick start

1. **Node.js** `v20.20.0` is required.

2. Install dependencies:
   ```sh
   corepack enable
   corepack prepare pnpm@9.15.0 --activate
   pnpm install
   ```

3. Copy the env file and fill in your credentials:
   ```sh
   cp apps/web/.env.example apps/web/.env.local
   ```
   See [`.env.example`](apps/web/.env.example) for all available variables. You'll need Spotify and TIDAL OAuth client credentials at minimum.

4. Run the dev server:
   ```sh
   pnpm dev
   ```

5. Run tests:
   ```sh
   pnpm test
   ```

6. Type-check:
   ```sh
   pnpm typecheck
   ```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and PR guidelines.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)

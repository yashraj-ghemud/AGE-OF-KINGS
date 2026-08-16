# AGE-OF-KINGS
> A TypeScript React + React Three Fiber browser game scaffold (Vite) with a client-side 3D scene, gameplay systems, UI, and Cloudflare Workers deployment hooks.

## Overview
Age of Kings is a single-page client application built with React and three.js (via React Three Fiber). The repository contains a browser game scaffolded with Vite that composes a 3D scene, gameplay components, sound initialization, and a campaign UI. The project includes build and deploy scripts that integrate with Cloudflare Wrangler.

## What it does
- Renders a real-time 3D game scene (Canvas) with environment, sky, and shadows.
- Provides player controls, units, projectiles, dragon cinematics, and visual effects.
- Includes UI components for menu/campaign, a loading screen, and an ErrorBoundary for runtime errors.
- Initializes audio on first user interaction and manages sound via a SoundManager utility (imported across components).
- Build and deploy flows integrate Vite and Cloudflare Wrangler (see package.json scripts).

## Key capabilities
- 3D world built with @react-three/fiber and @react-three/drei (Environment, Sky, ContactShadows).
- Player control and weapon switching.
- Projectile management including instanced meshes for performance-sensitive rendering.
- Dragon spawn/cinematic effects and AOE / rally indicators.
- Loading screen and campaign UI.
- ErrorBoundary for crash reporting in the UI.
- Cloudflare Workers deployment integration via @cloudflare/vite-plugin and wrangler.

## Technology
- TypeScript
- React 18
- Vite
- @react-three/fiber, @react-three/drei, three.js
- Tailwind CSS
- Zustand (state management)
- uuid
- lucide-react
- Cloudflare Vite plugin + wrangler

## Repository structure
Top-level files (evidence):
- .env.example
- index.html
- metadata.json
- package-lock.json
- package.json
- tsconfig.json
- tsconfig.node.json
- vite.config.ts
- wrangler.jsonc
- src/ (React components and app code)
- README.md (this file)

Notable code layout (from supplied sources):
- src/main.tsx -> App.tsx (application entry)
- src/components/ (Game.tsx, Player.tsx, ArrowManager.tsx, Projectiles.tsx, Dragon.tsx, Effects.tsx, UI.tsx, LoadingScreen.tsx, ErrorBoundary.tsx, Scenery, etc.)
- src/utils/SoundManager (imported by many components; source not fully present in the supplied dossier)
- src/store/gameStore (mutableGameState/useGameStore imported by many components; source not fully present in the supplied dossier)

## Getting started
The repository includes npm scripts in package.json. The supplied README excerpt and package.json indicate these basic steps:

1. Install dependencies:
   - npm install

2. Set environment key:
   - The project references GEMINI_API_KEY in a local environment file (.env.local). An .env.example file is present at the repo root; create .env.local as needed and set GEMINI_API_KEY there.

3. Development server:
   - npm run dev

Useful npm scripts (from package.json):
- dev: vite
- build: tsc && vite build
- preview: npm run build && wrangler dev
- lint: tsc --noEmit
- deploy: npm run build && wrangler deploy

Note: The repository does not include a documented Node.js version in the supplied evidence.

If you cannot run the app because modules or environment are missing, see the Configuration and Development notes below.

## Configuration
- .env.example is present in the repository root (use it to see expected environment keys).
- The app references GEMINI_API_KEY (create a local .env.local to provide this key if required).
- Cloudflare deployment is configured via wrangler (wrangler.jsonc) and the @cloudflare/vite-plugin; deployment credentials/tokens are not present in the repository and must be provided separately by maintainers.

To inspect configuration files:
- package.json — scripts and dependencies
- vite.config.ts — Vite configuration and plugins
- wrangler.jsonc — Cloudflare Worker configuration
- tsconfig.json / tsconfig.node.json — TypeScript configuration
- .env.example — example environment keys

## Development and quality notes
- TypeScript is used with strict compiler checks; lint script runs tsc --noEmit.
- There are no test suites or test-runner configuration evident in the supplied dossier (no jest/vitest/mocha, no test scripts).
- No CI workflow files are present in the supplied evidence (no .github/workflows).
- Some modules referenced by many components are not present in the supplied excerpts: notably src/store/gameStore and src/utils/SoundManager. Running a build (npm run build) or lint (npm run lint) will surface missing imports and type errors for contributors to address.
- The build script runs TypeScript type-checking before vite build (build = tsc && vite build).

Recommended initial developer checks:
- Run npm run lint to verify type-checking.
- Run npm run build to discover missing modules or build errors.
- Inspect src/components and the imports of store and utils to locate or restore missing modules.

## Safety and responsible use
- The code references GEMINI_API_KEY and Cloudflare Wrangler deployment. Treat such keys and deployment tokens as sensitive secrets: do not commit them to the repository.
- Ensure any .env.local or other secret files are listed in .gitignore (no .gitignore was visible in the supplied dossier).
- Review wrangler and Cloudflare configuration for least-privilege deployment tokens before use.
- This is a client-focused app; if you add any server-side components or external APIs, follow secure token storage and access policies.

## Contributing
- There is no CONTRIBUTING.md or CODE_OF_CONDUCT in the supplied evidence. To contribute, open issues and pull requests in the repository on GitHub.
- Before submitting PRs, run the type-check and build scripts (npm run lint, npm run build) to catch basic errors.
- When adding new secrets, provide an .env.example and ensure secrets are excluded via .gitignore.

## Notes for maintainers and next steps
The supplied audit identified these high-priority gaps to address in the repository (evidence-based):
- Ensure src/store/gameStore.ts and src/utils/SoundManager.ts are present and complete; many components import these modules.
- Add .env.example (already present) and ensure .env.local is ignored via .gitignore to prevent committing secrets.
- Add a lightweight CI that runs type-check and build on PRs.
- Add tests (unit and/or integration) for non-rendering game logic to reduce regression risk.

If you need to inspect the code paths referenced above, start by opening:
- src/components/Game.tsx, Player.tsx, ArrowManager.tsx, Projectiles.tsx, Dragon.tsx, UI.tsx, LoadingScreen.tsx, ErrorBoundary.tsx
- package.json, vite.config.ts, wrangler.jsonc, tsconfig.json

License
- No license file was present in the supplied dossier; none is declared here.

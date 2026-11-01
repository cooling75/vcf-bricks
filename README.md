# vcf-bricks

A browser-based workshop tool for sketching VMware Cloud Foundation (VCF) and vSphere Kubernetes Service (VKS) architectures together: components and simple colored frames for fleets, instances and domains. Built for architecture discussions and demos, not production planning or automated deployment.

**Live site:** https://cooling75.github.io/vcf-bricks/

Examples are illustrative discussion starters, not official reference architectures. The application interface, catalog, help and validation messages use English. Existing project titles, component labels and notes are preserved as entered, including drafts created with the earlier German interface.

## Placement and assignment

An explicit insertion target, catalog drag-and-drop with target highlighting, reassignment by dragging or using the properties panel, and an expandable structure tree simplify building a sketch. Existing communication relationships are preserved; their editing controls are collapsed by default. See [Placement and assignment](docs/placement-and-assignment.md).

Catalog badges have room for their labels, full component names wrap without clipping, and narrow screens use a single-column catalog. Names such as **vSphere Kubernetes Service – Cluster** remain available in full.

The online tool does not require a copy of the physical exhibition model. Dark mode, additional catalog components and individually adjustable frame font sizes are separate follow-up tasks.

## Run locally

Requirements: Node.js **24** (matching CI), npm and the committed `package-lock.json`.

```sh
npm ci
npm run dev
```

Open the address printed by the terminal with the **`/vcf-bricks/`** path. The development and preview scripts bind to `0.0.0.0`; use e.g. `npm run dev -- --host 127.0.0.1` for local-only access.

```sh
npm run typecheck
npm run test:run
npm run build
npx --no-install playwright install --with-deps chromium
npm run test:e2e -- --project=chromium
npm run preview -- --host 127.0.0.1
```

Browser tests build the application and start their own production preview on port 4174. A separately started preview is available at `http://127.0.0.1:4173/vcf-bricks/`. Installing browser system dependencies on Linux may require administrator privileges.

## Before a demo

- [ ] Open the VCF and VKS examples; review fleet, instance and domain boundaries and terminology.
- [ ] Add, move, edit, assign and delete components; test zoom and selection.
- [ ] Reload: the local draft must remain intact. Export JSON, reimport it and compare the contents. Invalid imports must not destroy the current draft.
- [ ] Check the production preview under `/vcf-bricks/` for missing assets, console errors and layout issues on the intended display.
- [ ] Clear local data after the demo and verify by reloading. Do not commit customer data or customer screenshots.

This manual check complements unit and browser tests. Architecture hints are not a support, compatibility, sizing or completeness guarantee; see [Architecture assumptions and limits](docs/architecture-assumptions.md).

## Data and limitations

The application is a static React/TypeScript/Vite app using `@xyflow/react`. Drafts stay in browser `localStorage`; JSON provides manual exchange. There is no application backend, live VCF/vCenter integration or application telemetry.

**Local storage is not encrypted.** Browser profiles, extensions and other users of the same profile can pose risks. JSON exports are plain text too. Do not use credentials, customer names or real infrastructure details in demos. The hosting provider may process normal technical access data; “no application telemetry” does not mean “no provider logs”.

On shared devices, clear the site's stored draft after the workshop and remove downloaded JSON files. Browser settings and developer tools can also clear storage for the origin; origin-wide deletion may affect other applications on the same origin, not just `/vcf-bricks/`. An export is a manual backup; local persistence does not replace backups.

## CI and hosting

- `ci.yml`: pull requests targeting `main` and pushes to `main`; Node 24, `npm ci`, typecheck, unit tests, build and Chromium browser tests. **No deployment.**
- `pages.yml`: pushes to `main` or manual runs on `main`; independent typecheck, unit, build and production browser-test gates, followed by a separate deployment job.
- Actions are pinned to verified release commit SHAs. Only the deployment job receives `pages: write` and `id-token: write`; pull-request code receives no deployment permissions.

GitHub Pages uses **GitHub Actions**; the `github-pages` environment allows only `main`. After publishing, verify the live site, reload behavior and JSON roundtrip. Run the same automated checks against the deployed site with:

```sh
PLAYWRIGHT_BASE_URL=https://cooling75.github.io/vcf-bricks/ npm run test:e2e
```

Only `dist/` is published. The Vite base path is `/vcf-bricks/`; review it when changing the repository name or hosting URL.

Hosting reference: [GitHub Pages with custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Project status and rights

An independent workshop project, not an official product or endorsement by Broadcom, VMware or SVA. Product names provide technical context; no official logos or partnership claims are used. A project license has not yet been selected; a public repository does not imply unrestricted permission to use it. Clarify rights and approvals before redistribution or production use.

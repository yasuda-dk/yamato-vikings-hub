# Testing

## Phase 0 checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## Current coverage

- Route rendering
- Bottom navigation
- Invalid route fallback
- 320px mobile rendering guard
- Environment validation
- GitHub Pages base-path helper
- PWA manifest metadata
- Playwright mobile smoke test on iPhone and Android-sized devices

Database, RLS, and Edge Function tests begin when schema and functions are added.

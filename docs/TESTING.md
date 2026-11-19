# Testing

## Phase 0 checks

```bash
npm run lint
npm run typecheck
npm run test
npm run test:functions
npm run build
npm run test:e2e
```

## Current coverage

- Route rendering
- On-demand route chunks, slow-screen loading, chunk failure recovery, and cached return navigation
- Viewport-triggered admin analytics with a fallback for browsers without IntersectionObserver
- Home module preloading alongside authentication, independent current-payment/history requests, history retry, no-current-Practice history, and regular-member privacy
- Startup and route football/photo loading animation, real image decoding, ball motion, reduced-motion support, and responsive Home banner/emblem layout

`tests/integration/practice-payment-loading.sql` checks the split payment RPCs against the legacy response using approved, selected profiles discovered at runtime. Run it as the database owner inside a rollback-only transaction on a populated test/approved environment. It changes no application records and verifies unchanged totals/pitches, denied unauthenticated and cross-team requests, and no historical tracking data for regular profiles. Apply the split-history migration first (or include it in the same rollback-only transaction when testing before deployment).

Playwright blocks service workers so delayed/failed chunk requests can be intercepted deterministically. PWA metadata remains covered separately. Screenshots of loading and error states are captured at 320px, 390px, and 430px.
- Bottom navigation
- Invalid route fallback
- 320px mobile rendering guard
- Environment validation
- GitHub Pages base-path helper
- PWA manifest metadata
- Playwright mobile smoke test on iPhone and Android-sized devices
- Edge Function shared response tests with Deno

Database and RLS tests should be expanded as Phase 1 hardens and before the Phase 1 PR is merged.

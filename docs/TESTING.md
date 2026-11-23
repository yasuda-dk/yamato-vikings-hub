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

- Annual MGP/MOP voting with required comments, self-voting, updates, year selection, closed/read-only states, load/save failures, and Takashi-only result rendering
- Annual award database/RLS integration tests in `tests/integration/annual-awards.sql`, using synthetic fixtures inside a rollback-only transaction: direct-table privacy, denial for other Admins, cross-team isolation, vote uniqueness, ties, deadline enforcement, inactive/revoked profiles, and protection against selecting a renamed reviewer profile
- Annual award phone screenshots and complete vote/result/close/profile-switch flows at 320px, 390px, and 430px on both device projects

- Route rendering
- On-demand route chunks, slow-screen loading, chunk failure recovery, and cached return navigation
- Viewport-triggered admin analytics with a fallback for browsers without IntersectionObserver
- Home module preloading alongside authentication, independent current-payment/history requests, history retry, no-current-Practice history, and regular-member privacy
- Startup and route football/photo loading animation, real image decoding, ball motion, reduced-motion support, and responsive Home banner/emblem layout
- Home banner overlay placement, white text, title fit, and locally served display font at 320px, 390px, and 430px

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

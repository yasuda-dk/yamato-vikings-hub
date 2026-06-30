---
name: mobile-ui-review
description: Use for every new Yamato Vikings Hub screen and every meaningful user-facing visual change. Ensures mobile portrait UI follows the repo design system and is visually reviewed before completion.
---

# Mobile UI Review

Use this skill for every new screen, form, navigation change, user-facing component, or meaningful visual adjustment in Yamato Vikings Hub.

## Required Workflow

1. Read `docs/UI_UX.md` before modifying user-facing UI.
2. State the screen's primary job and primary action before implementation.
3. Reuse existing components and design tokens wherever practical.
4. Implement the simplest layout that satisfies the user flow.
5. Start the development server.
6. Use Playwright or the Codex browser to inspect the rendered UI.
7. Capture screenshots at 320px, 390px, and 430px widths.
8. Check hierarchy, spacing, overflow, text wrapping, and touch targets.
9. Test loading, empty, error, disabled, success, and populated states.
10. Check that status is not communicated by color alone.
11. Iterate on the implementation after inspecting the screenshots.
12. Run accessibility, component, end-to-end, lint, typecheck, and build checks.
13. Do not declare completion until the visual review and tests pass.

## Design Rules

- English UI only.
- Mobile portrait only.
- Target 390px width.
- Must work from 320px to 430px.
- Use a modern, minimal Nordic football-club aesthetic.
- Use clean light backgrounds, white surfaces, deep navy text, and Japanese football blue as the primary accent.
- Use simple typography and strong visual hierarchy.
- Use a consistent 4px spacing scale.
- Minimum touch target is 44px.
- Use one clear primary action per screen.
- Keep fixed bottom navigation: Home, Events, Fines, Members.
- Prefer compact rows and simple sections over excessive cards.
- Use bottom sheets for mobile secondary actions.

## Avoid

- Generic admin-dashboard styling.
- Excessive cards.
- Gradients.
- Glassmorphism.
- Neon colors.
- Decorative blobs.
- Excessive shadows.
- Tiny text.
- Hover-dependent controls.
- Essential drag-and-drop interactions.
- Desktop-first layouts.
- Unnecessary animations.

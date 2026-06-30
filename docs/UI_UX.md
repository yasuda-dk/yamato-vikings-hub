# UI/UX Direction

Yamato Vikings Hub is a mobile portrait PWA for fast use around football sessions. The interface should feel calm, clear, and club-specific: modern minimal Nordic utility with Japanese football blue as the primary accent.

## Core Principles

- Use English UI text only.
- Design mobile portrait screens only.
- Target width: 390px.
- Must work correctly from 320px to 430px.
- On larger screens, center the mobile app and keep the narrow app width.
- Use one clear primary action per screen.
- Prefer compact rows and simple sections over excessive cards.
- Use bottom sheets for mobile secondary actions.
- Avoid desktop-first layouts and admin-dashboard styling.

## Visual System

- Background: clean light background.
- Surfaces: white.
- Text: deep navy.
- Primary accent: Japanese football blue.
- Avoid gradients, glassmorphism, neon colors, decorative blobs, and heavy shadows.
- Keep typography simple with strong hierarchy.
- Use a consistent 4px spacing scale.
- Maintain enough contrast for text, controls, and status labels.
- Do not communicate status by color alone; include text, iconography, or labels.

## Layout

- Fixed bottom navigation: Home, Events, Fines, Members.
- Keep primary content vertically scannable.
- Use compact rows for lists and summaries.
- Use simple sections for grouped information.
- Use cards only when an item genuinely needs a contained surface.
- Avoid excessive nested cards.
- Avoid horizontal scrolling.
- Text must wrap cleanly at 320px.
- Controls and labels must not overlap at 320px, 390px, or 430px widths.

## Touch And Interaction

- Minimum touch target: 44px.
- Do not rely on hover-dependent controls.
- Do not require drag-and-drop for essential interactions.
- Use large, obvious form fields and buttons.
- Use disabled states for unavailable actions.
- Use success states after meaningful completed actions.
- Use loading states for async work.
- Use error states with plain language and recovery paths.
- Use empty states that tell the user what is missing and what action is available.

## Screen State Requirements

Every user-facing screen must include and be reviewed in these states:

- Loading
- Empty
- Error
- Disabled
- Success
- Populated

## Visual Review Breakpoints

Review every new screen and meaningful visual change at:

- 320px width
- 390px width
- 430px width

At each width, check:

- Visual hierarchy
- Spacing rhythm
- Text wrapping
- Horizontal overflow
- Touch targets
- Bottom navigation visibility
- Primary action clarity
- Loading, empty, error, disabled, success, and populated states
- Status labels are understandable without relying on color alone

## Definition Of Done For UI Changes

A user-facing UI change is not complete until:

- `docs/UI_UX.md` has been read.
- The screen's primary job and primary action are stated.
- Existing components and design tokens are reused where practical.
- The simplest layout that satisfies the flow is implemented.
- The app is inspected in a real browser.
- Screenshots are captured at 320px, 390px, and 430px widths.
- Visual issues found in screenshots are fixed.
- Accessibility, component, end-to-end, lint, typecheck, and build checks pass.

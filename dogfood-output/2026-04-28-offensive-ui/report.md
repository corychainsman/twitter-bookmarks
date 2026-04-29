# Dogfood Report: Twitter Bookmarks Media Browser

| Field | Value |
|-------|-------|
| **Date** | 2026-04-28 |
| **App URL** | http://127.0.0.1:5173/ |
| **Session** | 2026-04-28-offensive-ui |
| **Scope** | Main grid, search, captions toggle, lightbox, and Theme Studio, with emphasis on offensive, hostile, misleading, or visually jarring UI. |

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 1 |
| **Total** | **1** |

One UI issue was found and fixed. The app itself did not show offensive product copy. The shipped bookmark data does contain raw third-party tweet text, including profanity; I treated that as user/content data rather than app-authored UI copy.

## Issues

### ISSUE-001: Captions toggle described the opposite action

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | UX / accessibility |
| **URL** | http://127.0.0.1:5173/ |
| **Status** | Fixed |

**Description**

The icon-only captions control used inverted labels. When captions were hidden, the toolbar exposed the control as "Hide captions"; when captions were visible, it exposed the control as "Show captions." That made the tooltip and accessible name misleading.

**Steps to Reproduce**

1. Navigate to the grid with captions hidden.
2. Inspect the captions control in the toolbar.
3. Toggle captions visible and inspect the same control again.

**Expected Behavior**

The control should describe the action it will perform: "Show captions" while captions are hidden, and "Hide captions" while captions are visible.

**Actual Behavior**

The action labels were reversed.

**Evidence**

Before fix:

MEDIA:screenshots/06-captions-visible-profanity-search.png

After fix:

MEDIA:screenshots/08-captions-hidden-fixed.png
MEDIA:screenshots/09-captions-visible-fixed.png

**Fix**

Updated the main toolbar and overflow-menu captions labels in `src/components/toolbar/BookmarksToolbar.tsx`, and updated the toolbar tests in `src/components/toolbar/BookmarksToolbar.test.tsx`.

## Summary Table

| ID | Title | Severity | Category | Status |
|----|-------|----------|----------|--------|
| ISSUE-001 | Captions toggle described the opposite action | low | UX / accessibility | Fixed |

## Testing Notes

- Loaded the local grid and confirmed no console warnings or errors.
- Opened a media item in the lightbox and confirmed the lightbox rendered after media load with no console warnings or errors.
- Exercised search with a profanity query to inspect how third-party bookmark text appears.
- Checked Theme Studio for obvious offensive or broken UI copy and console errors.
- Verified the captions-label fix in the browser after hot reload.
- Ran `bun run test -- src/components/toolbar/BookmarksToolbar.test.tsx`.
- Ran `bun run typecheck`.
- Ran `bun run lint`.
- Ran `bun run test`.
- Ran `bun run build`; Vite reported the existing large chunk-size warning.

# Dogfood Report: twitter-bookmarks-media-browser

| Field | Value |
|-------|-------|
| **Date** | 2026-04-24 |
| **App URL** | http://127.0.0.1:5173/ |
| **Session** | twitter-bookmarks-local |
| **Scope** | Full app dogfood with focus on masonry scrolling and display mode toggles |

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 0 |
| **Total** | **1** |

## Issues

<!-- Copy this block for each issue found. Interactive issues need video + step-by-step screenshots. Static issues (typos, visual glitches) only need a single screenshot -- set Repro Video to N/A. -->

### ISSUE-001: React 19 console error on initial masonry render

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | console |
| **URL** | http://127.0.0.1:5173/ |
| **Repro Video** | N/A |

**Description**

On a cold load, the masonry grid emitted a React 19 console error: `Accessing element.ref was removed in React 19`. The page rendered, but the same error came back on layout-triggering actions like zoom and caption toggles. Expected behavior was a clean console on initial render and after toolbar-driven relayouts. This was reproduced during dogfood and then verified clean in a fresh browser session after the local measurement wrapper was replaced.

**Repro Steps**

<!-- Each step has a screenshot. A reader should be able to follow along visually. -->

1. Navigate to http://127.0.0.1:5173/
   ![Initial load](screenshots/initial.png)

2. **Observe:** the UI loads, but the browser console reports `Accessing element.ref was removed in React 19` from the masonry measurement path.
   ![Initial load](screenshots/initial.png)

---

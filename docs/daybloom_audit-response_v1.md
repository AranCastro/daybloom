# Daybloom: Response to the Technical Audit (v1.0, 25 September 2026)

**Audited commit:** `874e4b1` (app 1.4.1). **Response release:** app 1.6.0 (Android `versionCode` 11).

*Table 1. Status of every finding. "Fixed" changes are covered by unit tests (`__tests__/`) or were re-run as in the audit where marked.*

| ID | Status | What changed |
|---|---|---|
| C1 | Fixed, re-tested | `useClock()` / `useToday()` (`src/hooks/use-today.ts`) keep the day and hour in state, refreshed at each hour boundary and on return to the foreground. Today, Matrix, Focus, Play, Garden, Calendar, Badges, quadrant screen and task sheet read it instead of calling `dayKey()` / `new Date()` in render; the Circle tab reads the name from the store. Audit run 3 repeated on the web build: at 00:02 the same session shows "SAT, 26 SEP", "Still up", the mood picker, and after Heavy the support card. |
| H1 | Fixed, tested | The nudge is disarmed and logged as queued before the request; only a later Okay-or-better day re-arms it (`lastNudgeDay`); `flushQueued()` keeps one in-flight promise; `fetch` aborts after 10 s. Tests fail on the old store and pass now. |
| H2 | Ready, needs the owner's key | The APK workflow signs with a private key from repository secrets when they are set (README, "Signing the test APK"). Until then it keeps the debug key. |
| H3 | Fixed | Android backup is kept on purpose (`allowBackup: true`) and paired with Backup and restore (1.5.0). In-app text, README, store listing, Data safety notes and the privacy policy now say where data can go. |
| H4 | Fixed, tested | The widget background task calls `flushQueued()` on every update and tap; Today says "Waiting for the internet to reach …" while queued; a nudge older than 36 hours is marked expired instead of being sent late. |
| M1 | Fixed, tested | Rarity drawn once; empty pool falls back to any non-legendary flower. |
| M2 | Partly | `SCHEDULE_EXACT_ALARM` declared (granted by default up to Android 13). On Android 14+ the alarm stays inexact unless the user allows exact alarms in system settings. |
| M3 | Fixed, tested | "Clear completed" clears only the open quadrant, asks first, and keeps the calendar shading (`clearedWork`). |
| M4 | Fixed, tested | Country code from the phone's region (India, US, Canada); otherwise the number is used as saved. |
| M5 | Fixed | Helpline by region: Tele-MANAS 14416 and 112 in India (and when no region is known), findahelpline.com and "your local emergency number" elsewhere. |
| M6 | Fixed | Wording now says the buddy never sees answers and knows a nudge means a few hard days (Circle, onboarding, README, store listing). |
| M7 | Open (documented) | The privacy policy describes ntfy.sh. Reserved topics or a self-hosted server remain future work. |
| M8 | Fixed | `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` blocked. |
| M9 | Fixed (1.5.0) | Backup and restore with a weekly backup. |
| M10 | Fixed | New `textMuted` (#736D66 light, #88827A dark) and `accentText` (#A94E2B) tokens meet 4.5:1; `Choice` is a radio group with checked state; task checkboxes carry the task title; quadrant numerals pick dark or white ink by contrast; the seven-day strip is labelled. |
| M11 | Fixed | The reminder is saved as on only when scheduling succeeded; Settings offers "Open settings". |
| M12 | Fixed | jest-expo with 13 tests; `checks.yml` runs typecheck, lint and tests on pull requests. |
| M13 | Fixed | Health apps declaration and other Play declarations added to the store listing checklist. |
| L1 | Fixed | A session is dated when it ended. |
| L2 | Fixed | Focus today widget uses `sortOpen` (follows Arrange). |
| L3 | Accepted | Calls started from widgets are not recorded as reach-outs (the app cannot see them). |
| L4 | Fixed, tested | Separate `bloomCount` drives the Golden Lotus and totals. |
| L5 | Open | Needs profiling on a low-end phone. |
| L6 | Fixed | Mood journal follows the week-start setting. |
| L7 | Fixed | A mood tap in a widget preview opens Today instead of checking in. |
| L8 | Fixed | Helpline links catch errors. |
| L9 | Fixed | Deleting a task or removing a person asks first. |
| L10 | Fixed | Nested state (`reminder`, `games`, `focus`) is merged with defaults on load. |
| L11 | Partly | Workflow write permission scoped to the APK job; actions are still pinned by tag. |
| L12 | Open | Transitive advisories; follow Expo patch releases. |
| L13 | Open | Colour Clash colour-blind variant is future work. |
| L14 | Fixed | The Breathe swell keeps pacing with Reduce motion on (`ReduceMotion.Never`). |
| L15 | Fixed | `checkinStreak` and five unused styles removed. |

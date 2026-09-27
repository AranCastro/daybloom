# Daybloom: Response to the second audit (v2)

**Response release:** app 3.0.0 (Android `versionCode` 23). Each finding below is fixed in that release unless stated.

*Table 1. Medium and data-layer findings.*

| ID | Fix |
|---|---|
| N2 | Each reminder button press is claimed once in shared storage (notification id + delivery time + action), so the background task and the in-app listener cannot both handle it. |
| N3 | While the lock is on, screenshots and the recent-apps preview are blocked (`expo-screen-capture`); "Immediately" locks as the app leaves the screen. |
| N4 | Lock record and failed-attempt count move to `expo-secure-store`; the PIN hash is salted and iterated; waits escalate from 30 s to 1 h and survive a force-stop. Android auto-backup is off (`allowBackup: false`). |
| N5 | `USE_EXACT_ALARM` declared, so the focus alarm is exact on Android 13+. Play Console needs the exact-alarm declaration (timer). |
| N6 | `expectReturn()` before pickers, share sheets, calls, messages and permission prompts; "Immediately" has a 5-second grace. The lock screen is a full-screen modal above any open sheet. |
| N7 | Focus alarm calls run in sequence with a token that Stop and Pause invalidate; notification setup runs once at start-up; widget focus buttons await the alarm. |
| N8 | The APK uses its own sideload key (`SIDELOAD_*` secrets), never the Play upload key; secrets are scoped to the signing steps; actions are pinned by commit; only builds from `main` are marked latest, branch builds are pre-release previews. |
| D1 | State writes are coalesced into one write per burst and flushed on leaving the app and before background tasks return; read and write failures are caught and shown in a banner with Try again. |
| D2 | `sanitise()` runs inside `mergeSaved` (launch and restore) and repairs or drops every malformed field; one test per audit input. |
| D3 | The backup picker is limited to JSON, text and unknown binary types, and files over 25 MB are refused before reading. |

*Table 2. Low findings.*

| ID | Fix |
|---|---|
| L1 | Legacy garden migration runs before the bloom count. |
| L2 | New monotonic `bloomsEver` sets the Golden Lotus cadence and the "Next golden" stats. |
| L3 | Patterns count cleared work. |
| L4 | Sessions beyond the 500 cap fold into `clearedFocus`, used by the calendar and focus streak. |
| L5 | Erase everything (and the forgotten-PIN path) deletes the weekly backup files. |
| L6 | Widget taps redraw once; the Configure screen reloads in an effect. |
| L7 | Notification channels are private on the lock screen (new channels for the nudge and "Noted"). |
| L8 | Weather checks its cache before asking for location; the timeout covers the JSON read. |
| L9 | Background audio mode is retried after a failure. |
| L10 | Truncation on all one-line widget texts; row budget from real heights; the Focus widget redraws at the session end while the app runs. With the app closed, the widget keeps the end time until the next tap or launch (the widget library has no countdown view). |
| L11–L24 | Screen, game, garden and performance fixes as listed in the audit (hasOwn preset check, draft re-sync, night-sky chip, dark-mode chips, measured illustrations, dismissAll before onboarding, font padding, window-sized orbs, restored reminder hour, opaque Android tab bar, cleared game timers, Fisher–Yates shuffle, garden and confetti bounds, static calendar dots and Poo Kolam thumbnails). |

Also: `expo-asset` is declared directly and `react-native-view-shot` is pinned to 5.1.0 (SDK 57).

## Interface (section 5)

All eight items are in 3.0.0: a shared `Tappable` press primitive; a type scale (`caption`, `micro`, `bodySm`, `numeral`, `display`); radius, spacing, shadow and status-colour tokens for both schemes; a fixed-width animated tab bar (Liquid Glass on iOS); raised cards and a dark-mode highlight; a single "Start here" card for new users, empty-state illustrations and a weather skeleton; the check-in orb grows into the hero; and a continuous focus ring with 5-minute ticks and tabular figures. All motion follows Reduce motion.

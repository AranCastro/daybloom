# Daybloom: Technical Audit v2.0 (27 September 2026)

**Audited commit:** `6dbe90c` (app 2.3.1, Android `versionCode` 22, Expo SDK 57, React Native 0.86.3, React 19.2, Reanimated 4.5.1).
**Method:** static reading of every file under `src/`, `index.ts`, `app.json` and the workflows, with library behaviour checked against the installed SDK 57 native sources rather than from memory; `npx tsc --noEmit`, `npx expo lint`, `npx jest` (62 tests) and `npx expo-doctor` were run on a clean install. Findings marked Fixed in the v1 audit response (`daybloom_audit-response_v1.md`) were re-checked and none has regressed, with one same-class exception noted at S3.
**Scope:** bugs first, then improvements towards the stated goal of a bug-free app with a premium interface. Nothing was modified.

*Table 1. Baseline checks on commit 6dbe90c.*

| Check | Result |
|---|---|
| `tsc --noEmit` | Pass |
| `expo lint` | Pass |
| `jest` | 7 suites, 62 tests, all pass |
| `expo-doctor` | 19 of 21 pass. `expo-asset` is a peer dependency of `expo-audio` but is not declared (it is present transitively); `react-native-view-shot` 6.0.1 is installed where SDK 57 expects 5.1.0. The APK workflow on `main` is green, so neither breaks the build today. |
| CI on `main` | Checks and Build Android APK both succeeded for 2.3.1 |

## 1. Summary

Forty-six findings: 2 High, 20 Medium, 24 Low. The code base is in good order (immutable store updates, stable selectors, cleared timers, tests for the reward logic), and most findings are edge cases rather than daily failures. The two High items are user-visible on ordinary phones: the app lock is drawn beneath any open sheet, and the Pair Up board does not fit on a small screen. The Medium group clusters into four themes: navigation from widget deep links, background and lifecycle handling in games and timers, restore validation, and Android 14+ alarm precision.

Recommended order of work (Section 6): fix the two High and the six "premium-blocking" Medium items first (roughly two working days), then the restore sanitiser and persistence coalescing, then the design-system pass in Section 5.

## 2. High severity

### H1. App lock is drawn under any open sheet
`src/app/_layout.tsx:99` mounts `LockGate` as an absolutely positioned view inside the root; `src/components/lock-screen.tsx:132,159` give it `zIndex`/`elevation` 1000. Every sheet in the app is a React Native `Modal` (`tasks.tsx:263`, `people.tsx:106`, `place-picker.tsx:109`, `profile.tsx:75`, `buddy.tsx:163`, `badge.tsx:55`, `app-lock-card.tsx:85`), and on Android a `Modal` is a separate window above the Activity content, so it always sits above the gate.
Scenario: the "Add person" sheet is open, the user switches apps or opens the contact picker, and returns after the lock delay. The store sets `locked = true`, the PIN pad mounts, but the sheet (name, phone number) remains visible and usable until it is closed.
Fix: render the gate itself as a `Modal` (`visible={locked}`, `presentationStyle="fullScreen"`, `statusBarTranslucent`, `hardwareAccelerated`) mounted last in the root, and additionally pass `visible={props.visible && !locked}` to each sheet.

### H2. Pair Up board overflows small screens
`src/components/games/memory.tsx:41,196,262-264`: Normal is 6 pairs in 3 columns (4 rows), each cell `width: 33.3%` with `aspectRatio: 0.82`, inside a non-scrolling `GameShell`. On a 375 × 667 pt phone the grid alone is about 560 pt; with header, level chooser and stats about 720 pt is needed where roughly 610 pt is available. The bottom row is off-screen and cannot be tapped. A 360 × 640 dp Android phone is worse.
Fix: measure `gridWrap` with `onLayout` and set each cell to `Math.min(width / cols, height / rows)` with explicit `width` and `height`, or choose `cols` from `useWindowDimensions` so Normal uses 4 columns when the height is under 700 dp.

## 3. Medium severity

### 3.1 Navigation and screens

**S1. Back arrow is dead when a screen opens from a widget deep link.** `src/app/_layout.tsx` declares no `unstable_settings.anchor`; widgets link straight to `daybloom://quadrant/1` and other detail routes (`src/widgets/widgets.tsx:674`). On a cold start the stack holds only that screen, so `router.back()` (`quadrant/[q].tsx:38`, and likewise settings, calendar, badges, places, thottam, send-flower) has no history: the in-app arrow does nothing and Android back exits the app. Fix: `export const unstable_settings = { anchor: '(tabs)' }` in the root layout, and a shared `goBack(fallback)` that uses `router.canGoBack()` and otherwise `router.replace(fallback)`.

**S2. `TabBarInset` is a constant, not the real bar height.** `src/constants/theme.ts:72` assumes 24 dp of bottom inset on Android; `tab-bar.tsx:26` pads by `max(insets.bottom, 14)`. With 3-button navigation (`insets.bottom ≈ 48`) the bar is about 112 dp tall while Matrix pads 94 dp (`matrix.tsx:43`), so the lower quadrants and the floating add button (`bottom: 106`) sit under the bar. Fix: a `useTabBarInset()` hook returning `TabBarHeight + Math.max(insets.bottom, 14)`, used by all six tabs.

**S3. Focus streak goes stale after midnight** (same class as v1 finding C1). `src/app/(tabs)/focus.tsx:380` calls `focusStreak(sessions)` whose default `today = new Date()` (`src/lib/focus.ts:107`) is evaluated at render; the React Compiler memoises on `sessions` only, and tabs stay mounted. Fix: `focusStreak(sessions, fromKey(todayKey))`.

**S4. Keyboard handling in `Screen`.** `src/components/ui.tsx:59-63`: the ScrollView has no `keyboardShouldPersistTaps` and no `KeyboardAvoidingView`. Inputs affected: Settings name and the eight section-name fields, Thottam design name, Send a flower, the good-day note on Today. The first tap on Save only dismisses the keyboard; on iOS the lower Settings fields are hidden behind it. Fix: `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`, and `KeyboardAvoidingView behavior="padding"` on iOS (as onboarding and the task sheet already do).

**S5. Rapid double tap pushes the same screen twice.** All `router.push` calls from Pressables are unguarded (Today ×6, Matrix ×2, Garden ×3, Circle, Settings, place picker, badge, task sheet, Play ×2). A double tap on the Settings gear opens Settings twice. Fix: `router.navigate` for singleton screens, or a small press guard (ignore presses within 600 ms).

**S6. Android hardware back exits the app during onboarding.** `src/app/onboarding.tsx` registers no `BackHandler`; `gestureEnabled: false` only affects the iOS swipe. Fix: a `hardwareBackPress` listener that steps back while `step > 0`.

**S7. No font-scaling cap; fixed-height containers clip at large system text.** `src/components/text.tsx` never sets `maxFontSizeMultiplier`, and several containers use fixed heights: circle cards `height: 206` (`circle.tsx:191`), streak chip 40 (`today.tsx:499`), tab bar 64 with a label, matrix count pill 22. At iOS Accessibility XL or Android "Largest", labels overflow chips and the tab label wraps inside the bar. Fix: `maxFontSizeMultiplier={1.35}` as the default in `Text`, `minHeight` instead of `height` on the containers above.

**S8. Accessibility roles, labels and targets.** Missing `accessibilityRole="button"` on `Row` (`ui.tsx:152`), the buddy card, month arrows (no label either), person rows, task titles, chips, every back arrow (label present, role absent). Touch targets under 44 pt: "Pin with GPS" and "Remove" in Places, "Arrange" and "Clear" in a quadrant, "Open matrix" on Today. Fix: add roles, labels and `accessibilityState`; give text links `minHeight: 44` or `hitSlop={14}`; mark the tab bar container `tablist`.

### 3.2 Games and timers

**G1. Bubbles leave the visible field but still count towards the cap.** `src/components/games/bubbles.tsx:65` uses the window height as travel distance, but the field is 150–200 dp shorter (header, timer bar, safe areas). Each bubble is invisible for the last 20–25 % of its animation yet holds one of the 13 on-screen slots, so the spawner stalls with nothing visible, most noticeably in Zen. Fix: measure the field with `onLayout` and animate to `-(fieldH + size + 10)`.

**G2. Round clocks count ticks, not time.** `breathe.tsx:118`, `bubbles.tsx:101`, `colours.tsx:83`, `memory.tsx:92` all decrement a ref on a 1-second `setInterval`; JS-thread contention (each pop re-renders the whole field) delays ticks, so a "60-second dash" runs long. In Bubble Pop the speed-up uses wall-clock time (`bubbles.tsx:74-75`) while the countdown freezes during a background pause, so on return the bubbles are at full speed with most of the timer left. Fix: store `endAt` at start, shift it by the paused interval on resume, tick every 250 ms and derive `left` and `elapsed` from the same `endAt`.

**G3. Breathe orb desynchronises after a background pause and snaps on Stop.** `breathe.tsx:116-138`: the JS interval pauses when the app is inactive but the UI-thread `withTiming` completes regardless, so on return the orb is fully expanded while the label still says "Breathe in 3". Stop leaves the orb mid-animation and the next start jumps to `SMALL`. Fix: `cancelAnimation` on both shared values when inactive, re-issue `withTiming` for the remaining phase time on resume, and animate to `SMALL` over 400 ms on Stop.

**G4. Colour Clash 3-2-1 countdown is not paused in the background.** `colours.tsx:193` renders `Countdown` (`fx.tsx:132-147`) without the `appActive` gate the play phase has. On Android the round begins while the app is hidden; the user returns to a started round. Fix: a `paused` prop on `Countdown` driven by `useAppActive()`.

**G5. No exit confirmation on Android back or the X during a round.** `_layout.tsx:95` only disables the iOS gesture; `shell.tsx:25` calls `router.back()` unconditionally. Hardware back mid-dash discards the round silently; in Zen the unmount recorder blooms after navigation so the toast appears on the Play tab out of context. Fix: a `beforeRemove` listener in `GameShell` that asks "Leave the game?" while a round is in progress.

### 3.3 Native integration and background work

**N1. Widget Stop on a finished session discards the earned flower.** `src/widgets/widgets.tsx:432-438` shows Stop even when `done`; `task-handler.ts:62` calls `stopTimer()` (`focus.ts:70`), which clears the timer without `completeFocus()`. A session that ends while the app is closed shows "Open to collect your flower"; tapping Stop loses the session and the flower, with no confirmation (the in-app Stop asks first). Fix: in the handler, complete the session when `remaining === 0`, and relabel or hide Stop when `done`.

**N2. Reminder mood buttons handled twice when the app is backgrounded but alive.** `index.ts:24-30` defines the TaskManager task and `_layout.tsx:69-74` also subscribes a response listener. In SDK 57 (`ExpoHandlingDelegate.kt:160-175`) a non-default action while the app is not resumed runs the task **and** emits to JS listeners, so `handleCheckinAction` runs twice. Today the second `recordMood` is idempotent, but `notifyCheckinNoted` fires twice and the second call (no `grew`) overwrites "A Jasmine bloomed" with "Thank you for checking in"; any future non-idempotent work in that path will double. Fix: dedupe by `${notificationId}:${actionId}` in the kv store (shared by both contexts), or skip the layout listener when `AppState.currentState !== 'active'` on Android.

**N3. The lock does not protect the app-switcher snapshot.** Lock engages only on the next `active` (`app-lock.ts:155-158`); Android captures the recents thumbnail at `onPause`, before that, and no `FLAG_SECURE` is set. With "Lock immediately" on, the last screen (a Heavy check-in, a good-day note) is visible in the recents carousel. Fix: `expo-screen-capture` `preventScreenCaptureAsync()` while the lock is enabled, or set `locked = true` synchronously on `background` when the delay is 0.

**N4. PIN protection is weak offline and the lockout is in memory.** `app-lock.ts:52-54`: one SHA-256 of `salt:PIN` over 10 000 candidates is recovered instantly if the kv database leaks, and `allowBackup: true` with no `dataExtractionRules` sends that database (with the lock key) to Google Drive. `tries` and `waitUntil` are module variables (`:39-40`), so force-stopping the app resets the 30-second wait: five guesses per relaunch, without limit. Fix: keep the lock record in `expo-secure-store`, persist tries and an escalating wait, and exclude the lock key from auto-backup.

**N5. Exact alarms are silently inexact on Android 14+** (v1 finding M2, still partial). `reminders.ts:74,92` use DAILY and DATE triggers; `ExpoSchedulingDelegate.kt:106-114` falls back to an inexact alarm unless `canScheduleExactAlarms()`, which is denied by default on API 34+ and never requested. In Doze the "Focus session complete" alarm can arrive 5–15 minutes late while the widget still says "Ends 14:25". Fix: a Pomodoro timer qualifies for `USE_EXACT_ALARM` under Play policy; otherwise open `android.settings.REQUEST_SCHEDULE_EXACT_ALARM` on first focus start and show a "may be delayed" hint if refused.

**N6. "Lock immediately" re-locks after every picker, share or dial round trip.** Android emits `background` on `Activity.onPause`, which the contact picker, document picker, share sheet, `tel:`/`sms:`/WhatsApp intents and the permission dialog all cause. Each return lands on the PIN pad, and because of H1 the originating sheet sits above it. Fix: an `expectingReturn` flag set before those calls and cleared on the next `active`, or a 5-second minimum for "Immediately".

**N7. Alarm scheduling races the next timer action.** `focus.ts:204-209` fires `scheduleFocusAlarm` without awaiting; it first awaits `ensureReady()` (three channel calls, category, permission) before cancel + schedule, while Stop and Pause cancel immediately. Start then Stop within about 300 ms leaves an alarm that fires 25 minutes later with no session. From a widget with the app killed, the headless task returns before the alarm is scheduled and the process may be reclaimed. Fix: a sequence token checked after `ensureReady()`, bumped by `cancelFocusAlarm`; await the start in the widget handler; do channel and category setup once at start-up.

**N8. GitHub APK is signed with the Play upload key.** `android-apk.yml:236-250` and `play-bundle.yml:380-394` use the same `ANDROID_KEYSTORE_*` secrets, while Play App Signing re-signs with Google's key. A tester who sideloads then installs from Play gets a signature mismatch and must uninstall, losing local data. `KEYSTORE_B64` is a job-level environment variable visible to every third-party action step, and `make_latest: true` marks every push to `main` as the latest release. Fix: a dedicated sideload keystore, the secret scoped to the signing step only, actions pinned by SHA, `make_latest: false` for test builds.

### 3.4 Data layer

**D1. Every update serialises and writes the whole state synchronously, several times per action.** `store.ts:299-303` and `kv.ts:8-10`: `JSON.stringify(state)` plus `setItemSync` on the JS thread on every `update()`, with no coalescing. One widget tap on the last step of a task performs six full writes; with a full garden (2 000 blooms, about 260 KB) that is over 1 MB of synchronous work per tap. `kv.ts` has no `try/catch`: if the write throws (disk full), `state` is already assigned but listeners are never notified and the exception reaches the tap handler; `load()` does not guard `readItem`, so a database open failure crashes at import. Fix: keep `state = next; notify()` synchronous, schedule the write in a microtask with a dirty flag, flush on `background` and before a headless task returns, wrap both read and write, and surface a `saveFailed` banner.

**D2. Restore validates container types only; a malformed file becomes a crash loop.** `backup-core.ts:56-62` checks that four lists are arrays and two maps are objects, nothing else; `mergeSaved` spreads the rest through. Inputs that pass and are then persisted: `{"garden":[null]}` (Today throws on `b.at`), `{"focus":{"sessions":"x"}}` (Focus tab and calendar throw), `{"widgetLocks":null}` (every widget tap throws), check-in values outside 1–5. Because the state is written before the crash, the app fails on every launch and the only exit is Erase everything. The README says the restore "checks it really is one". Fix: a `sanitise()` step in `mergeSaved` (the single choke point for load and restore) that drops malformed items, clamps mood values and validates day keys, with a test per input above.

**D3. Backup picker reads any file fully into memory.** `backup.ts:55-57` accepts `*/*` then `new File(uri).text()`. A video picked by mistake is read as one string before "not a Daybloom backup" can appear. Fix: check `File.size` (SDK 57) against a 25 MB ceiling first and restrict the picker to JSON and plain text.

## 4. Low severity

*Table 2. Low findings, grouped by area.*

| ID | Area | File | Finding and fix |
|---|---|---|---|
| L1 | Data | `store.ts:264` vs `280-282` | Legacy migration sets `bloomCount` from an empty garden before the focus-sessions garden is built; old saves show N flowers and total 0. Move the migration block above the count. |
| L2 | Data | `store.ts:556-561`, `flowers.ts:43` | Untick refunds `bloomCount`, so the Golden Lotus at bloom 20 can be re-earned by tick, untick, tick. Keep a monotonic `bloomsEver` for the lotus cadence. |
| L3 | Data | `patterns.ts:63-68` | Pattern "two finished tasks" ignores `clearedWork`, so users who clear quadrants lose the evidence. Add `clearedWork[d]` to the count. |
| L4 | Data | `focus.ts:88` | The 500-session cap silently erodes calendar shading and focus streak after about eight months. Fold dropped sessions into a `clearedFocus` day map, as `clearedWork` does for tasks. |
| L5 | Privacy | `store.ts:449`, `backup.ts:68-72` | Erase everything leaves up to four weekly backup files (moods, notes, phone numbers) under `Paths.document/backups`. Delete them in `wipe()` and the forgot-PIN path. |
| L6 | Widgets | `task-handler.ts:26`, `sync.ts:112`, `configure.tsx:31` | Each widget tap redraws all widgets twice (reload emission plus explicit refresh); the Configure screen calls `reloadState()` inside a `useState` initialiser, which updates other components during render. Add a silent reload; move the call to an effect. |
| L7 | Notifications | `reminders.ts:42-53` | Channels set no `lockscreenVisibility`; "Noted: Low" and the buddy nudge text show on the lock screen. Set `PRIVATE`. |
| L8 | Weather | `weather.ts:383-394` | Location is requested before the 30-minute cache is checked, and the 10-second abort is cleared before `res.json()`, which can hang. Reorder; clear after parsing. |
| L9 | Audio | `focus-sound.ts:30-34` | `modeSet = true` before the await; a single rejection means background audio mode is never retried. |
| L10 | Widgets | `widgets.tsx:220,444,348` | `maxLines={1}` without `truncate="END"` clips glyphs; the Tasks row budget undercounts row height so "+n more" can fall off a 4×2 widget; the Focus widget is not refreshed at `endAt`. |
| L11 | Screens | `focus.tsx:79,87` | `params.preset in PRESETS` accepts inherited keys: `daybloom://focus?preset=constructor` yields "Start NaN-minute focus". Use `Object.hasOwn`. |
| L12 | Screens | `settings.tsx:37,365` | Name drafts are not re-synchronised after a Restore; blurring a field writes the stale draft over the restored label. Reset the draft when `value` changes. |
| L13 | Screens | `garden.tsx:37` | Empty-garden message is hard-coded dark green over the night sky: near-invisible for a user who installs after 19:00. Use a translucent chip. |
| L14 | Screens | `garden-sky.tsx:199,216`, `mood-tags.tsx:55` | Live-weather prompt and selected mood-tag chips use light-palette colours in dark mode. |
| L15 | Screens | `places.tsx:147`, `thottam.tsx:46` | Illustration widths ignore the card gutter by 12–14 px and spill into the padding. Measure with `onLayout`. |
| L16 | Screens | `settings.tsx:69` | Erase everything replaces only Settings, leaving the old tab navigator beneath onboarding; iOS swipe-back reveals it. `router.dismissAll()` first. |
| L17 | Screens | `text.tsx:23-25` and chip numerals | No `includeFontPadding: false` on tight display line heights; Fraunces sits low and clips descenders on Android. |
| L18 | Screens | `today.tsx:114-128` | Five 54 px orbs plus chrome is 354 dp, wider than a 320 dp phone. Size from the window width. |
| L19 | Screens | `settings.tsx:208,240` | Reminder-hour `Choice` shows nothing selected if the hour is not 8/13/19/21 (restored data); `Linking.openURL` without a catch. |
| L20 | Screens | `tab-bar.tsx:61-66` | Android elevation with a translucent background draws the shadow through the bar. |
| L21 | Games | `memory.tsx:130-153` | Three timeouts are never cleared on unmount; closing within 320 ms of the last match awards the flower after the screen is gone. |
| L22 | Games | `memory.tsx:48` | `sort(() => Math.random() - 0.5)` is a biased shuffle; reuse the Fisher–Yates loop below it. |
| L23 | Garden | `garden.tsx:48-51`, `garden-sky.tsx:195`, `fx.tsx:101` | Right-edge flowers clip at `left: 88 %` in the small Focus bed; the sun glow uses shadow props with `elevation: 0` so Android draws a flat disc; confetti falls a fixed 700 px and stops mid-screen on tall phones. |
| L24 | Performance | `journey.tsx:234`, `thottam.tsx:222-240` | 31 `MoodOrb`s in the calendar each run four hooks and two gradients; the Thottam gallery renders up to 60 full Poo Kolam SVGs (about 200 nodes each) in one ScrollView. A static `MoodDot` and a thumbnail mode or `FlatList`. |

Also low: `expo-asset` should be declared directly (`npx expo install expo-asset`) and `react-native-view-shot` pinned to the SDK 57 version, so `expo-doctor` is clean before the next store submission.

## 5. Improvements towards a premium interface

The visual language (Fraunces display, Manrope body, warm paper neutrals, forest brand, no red for low moods) is sound. What separates it from a premium product is consistency and motion, not a redesign. In order of impact:

1. **One press-feedback primitive.** Cards-as-buttons mix `opacity 0.85`, `scale 0.97`, `scale 0.94` and nothing at all (the buddy card, garden rows, person rows). Add a `Tappable` in `ui.tsx` (Reanimated scale 0.985 spring, `tap()` haptic, `android_ripple` with `overflow: hidden`) and use it everywhere a card is pressable.
2. **Typography scale.** More than 150 inline `fontSize` overrides (12, 13, 11.5, 12.5, 14.5, 13.5, 10.5) and raw `fontFamily` styles bypass the colour tokens. Add `caption`, `micro`, `bodySm` and `numeral` (tabular figures, `includeFontPadding: false`) variants to `text.tsx` and remove the inline sizes.
3. **Spacing, radius and status colours as tokens.** Nineteen distinct radii and five paddings are in use; `#3A9477`, `#C9503B`, `#D08A2E`, `#C98A1E`, `#7E6FD0` recur in six or more files without dark variants. Collapse to `Radius.xs/sm/md/lg/xl/pill`, `Spacing.screen/card/cardCompact`, and add `success`, `warning`, `danger`, `rare`, `legendary`, `tagWarm`, `tagCool` to `Colors` for both schemes. Nest radii concentrically (inner = outer − padding).
4. **Tab bar.** The bar's width changes when the focused label appears, so every item jumps. Fix the width, animate the active pill with `LinearTransition.springify()`, fade the label in, and on iOS use `GlassView` from the already-installed `expo-glass-effect`.
5. **Elevation and dark surfaces.** Cards are flat 1 px lines everywhere. Add `Shadow.sm/md` tokens (iOS shadow, Android elevation on an opaque wrapper) and a raised `Card` tone for the mood hero, the focus reward and the badge hero; in dark mode use a top highlight `rgba(255,255,255,0.06)` and raise the `glowA/glowB` alpha in `Backdrop`, which is nearly invisible on `#12110F`.
6. **First run and empty states.** A new user's Today stacks seven mostly empty cards. Collapse them into one "Start here" card until the first check-in, then reveal the rest with `FadeInDown`. Give the empty matrix and empty garden a small flower illustration and a one-line call to action; show a skeleton on the weather chip while it loads.
7. **Mood check-in choreography.** The picker and the done card swap with a plain fade. Grow the chosen orb from 54 px to the 148 px hero with a layout animation, stagger the other four out, then slide the tag and place pickers in 150 ms later.
8. **Focus ring.** Progress steps once a second with a 300 ms tween. Drive it with a single linear `withTiming` over the remaining time, add faint 5-minute tick marks, a soft glow in the ring colour and tabular figures on the clock.
9. **Sheets.** React Native `Modal` sheets have an instant scrim and no drag to dismiss. Use stack screens with `presentation: 'formSheet'` and `sheetAllowedDetents` (react-native-screens 4), which also resolves H1 because the lock gate then sits in the same window.
10. **Game juice.** Springs instead of linear timing on the bubble pop and card flip; an expanding ring on each pop; a Success then Heavy haptic on a golden bubble; a score pill that bumps on change; a result panel that counts the number up, then stars, then the "personal best" badge; `LinearTransition` on the Colour Clash keys so shuffles slide rather than jump. Keep the bubble score in a shared value so a pop does not re-render the whole field.
11. **Garden depth.** Deterministic jitter (hash of the bloom id) for x offset, scale and rotation; a soft ground ellipse under each stem; lower opacity for back rows; a `ZoomIn.springify()` entrance for the newest flower with `LinearTransition` on the rest; cloud drift, star twinkle and a 1.2-second cross-fade between sky phases, all gated on focus, app active and reduce motion.
12. **Iconography.** Line icons are drawn at 13–28 px with a constant 1.8 stroke, so small ones look hairline; scale the stroke. Energy, effort, mood tags and places use emoji, which render differently per platform; either add line icons for these or wrap emoji in a fixed text style so baselines align.
13. **Onboarding.** Live previews per step (greeting updating as the name is typed, the real nudge message bubble, a mock notification), `SlideInRight`/`SlideOutLeft` between steps, and the first flower blooming into the garden before the app opens.

Data-layer improvements that support the above: schema versioning with ordered migrations and the sanitiser from D2 as the final step; write coalescing with a save-failure signal (D1); a retention model that separates capped event logs (garden, sessions) from never-capped daily aggregates so the calendar, streaks and patterns never lose history (L2, L4); a foreground `reloadState()` guarded by a `savedAt` stamp; and a checksum in the backup file so truncated Drive downloads are rejected with a clear reason.

## 6. Suggested order of work

*Table 3. Proposed batches.*

| Batch | Items | Why first |
|---|---|---|
| 1 (release blocker) | H1, H2, N1, S1, S3, L11 | Visible to any user on an ordinary phone, or lose earned rewards; each is a small, local change. |
| 2 (lifecycle) | G1–G5, N2, N7, S6, L21 | Games and timers behave wrongly after a phone call, a notification shade or a background pause, which is the normal way a mobile app is used. |
| 3 (safety) | D1, D2, D3, N3, N4, N6, L5, L7 | A bad restore or a leaked database should not be unrecoverable or expose moods. |
| 4 (platform) | S2, S4, S5, S7, S8, N5, N8, L16–L20 | Layout, keyboard, accessibility and Android 14+ alarm precision. |
| 5 (premium pass) | Section 5, items 1–13, with L13, L14, L23, L24 | Design tokens first (items 1–3), since every later motion change builds on them. |

Each batch should keep `tsc`, `lint` and `jest` green, add a test for every data-layer change (the existing suites in `__tests__/` are the pattern), and be verified on one small Android phone (360 × 640 dp, 3-button navigation, Android 14) and one iPhone SE, since most layout findings only appear there.

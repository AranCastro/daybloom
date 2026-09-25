# Daybloom: Mood & Garden — mobile app

*Grow a little every day.*

One calm app where everything you do grows the same garden:

- **Nudge a Friend.** Tap your mood once a day. After a set number of low days in a row (default three),
  one trusted friend receives a single line: "Call Aran today." They are never told why.
- **Eisenhower Matrix.** Sort tasks into Do first, Schedule, Delegate and Later, with due-date badges.
  Today's screen shows a short Focus list (due or late first, then Do first), reduced to one task on a low day.
  **Arrange** (in each quadrant, or Move up / Move down in a task) sets your own order; the widgets follow it.
  **Calendar** (icon on the Matrix tab): a month view with a dot per task due, in quadrant colours; pick a day
  to see, tick or add its tasks, with that day's mood and flowers. Any due date can be picked from a calendar.

- **Circle matrix.** Sort trusted people by closeness (close / wider) and how to reach them (call / message):
  Call anytime, Quick call, Message first, Light chat. On a Low or Heavy day, Today suggests one person to
  call and one to message (least recently reached first), with one-tap Call, SMS and WhatsApp.

- **Play.** Four short games, one picked for today's mood:
  - Breathe (Heavy): Calm 4-2-6, Box 4-4-4-4 or Unwind 4-7-8, with a session progress ring.
  - Bubble Pop (Low): Zen (untimed) or a 60-second dash; rare golden bubbles are worth 5.
  - Pair Up (Okay): Easy, Normal or Hard memory board with 3D flips, timer and star rating.
  - Colour Clash (Good or Bright): 30 s word-colour challenge with streak multipliers and shuffling keys.
  Answers and pops register on touch-down, so quick taps are never lost. Best scores are kept.

- **Focus timer (Pomodoro).** Gentle 15/3, Classic 25/5 or Deep 50/10 (Gentle is suggested on a low day),
  optionally linked to a task. The timer is stored as an end time, so it stays right when the app is
  closed; an alarm notification fires at the end and the screen stays awake while it runs.
  **Reward:** every finished session grows a flower in the shared garden (15% rare chance), revealed on
  screen. Stopping early grows nothing.

- **Streak and badges.** Daily check-in streak with a rest day (after 7 check-ins in a row, one missed day is
  forgiven), best streak and a 14-day strip. 12 badges in bronze, silver and gold: first check-in,
  3/7/14/30/60/100-day streaks, 10/50/100 days noted, Honest day (checking in on a Low or Heavy day) and
  Welcome back (returning after 3+ days away). New badges are celebrated after the check-in; earned badges
  are kept even if a streak ends.

- **One garden for everything.** Every activity grows a flower in the same garden: the daily check-in
  (one a day), each finished task (unticking takes it back), each focus session, the first finish of each
  game per day, reaching out to someone (one a day) and every badge (always rare). Golden Lotus every 20th
  bloom. A toast announces each bloom anywhere in the app; Today shows today's blooms; the **Garden tab**
  (formerly Journey) holds the illustrated garden, "ways to grow today", latest blooms, the 12-flower
  collection, badges and the mood journal.

- **Home-screen widgets (Android).** Eight widgets, each in light and dark: Eisenhower Matrix (4 × 3; all four
  quadrants, tick tasks off in place), People circle (4 × 3; tap a name to call or message, or use its call and WhatsApp buttons), Mood check-in (4 × 1; tap a mood to
  check in), Focus today (4 × 2; tick off tasks, each grows a flower), Garden (2 × 2), Focus timer (2 × 2; 15/25/50
  minute presets open the timer), Streak (2 × 1) and Reach out (4 × 1; one tap to call or message). Settings →
  Home screen widgets shows live previews and an **Add to home screen** button. The two matrix widgets have their
  own settings there: theme (auto, light, dark), background opacity, text size, checkboxes or call and WhatsApp buttons, and
  whether finished tasks are listed. Built with
  [react-native-android-widget](https://github.com/sAleksovski/react-native-android-widget); the code is in
  `src/widgets/` and the widget list in the plugin entry of `app.json`. Widgets need the APK or a development
  build; they do not run in Expo Go.

Moods, tasks, people, scores, focus sessions, badges and the garden never leave the phone.

Built with Expo SDK 57 (React Native 0.86, Expo Router, TypeScript).

## Run it on your phone (Windows, no Android Studio)

1. Install Node.js 22 LTS from https://nodejs.org.
2. In PowerShell:

   ```powershell
   cd mobile
   npm install
   npx expo start
   ```

3. Install **Expo Go** from the Play Store and scan the QR code shown in the terminal.

Everything in this app works in Expo Go (local notifications, haptics, SQLite storage, SVG, gradients,
contact picker) except the home-screen widgets, which need the APK (below).

WhatsApp links need an international number. A bare 10-digit number is treated as Indian (+91); numbers
saved with a country code (for example +44 …) are used as they are (`src/lib/reach.ts`).

## Download a test APK (no setup needed)

Every change to `mobile/` on `main` is built automatically by GitHub Actions
(`.github/workflows/android-apk.yml`) and published as a release:

**https://github.com/AranCastro/AranCastro.github.io/releases/latest**

Open that page on an Android phone, tap the `.apk`, and allow installing from the browser when asked.
To rebuild by hand: GitHub → **Actions** → **Build Android APK** → **Run workflow**. These test builds
are signed with a debug key; Play Store builds come from `eas build --profile production` (below).

## Build for the Play Store

The build runs in Expo's cloud (EAS), so no Android SDK is needed locally.

```powershell
npm install -g eas-cli
eas login                      # free Expo account
eas build:configure            # links the project; keeps the existing eas.json
eas build -p android --profile preview      # installable .apk for testing
eas build -p android --profile production   # .aab for the Play Console
eas submit -p android          # uploads to the Play Console internal track
```

Before the first production build:

- **Names:** the Play Store title is **Daybloom: Mood & Garden**; the name under the icon (`name` in
  `app.json`) stays **Daybloom**, because launchers truncate long names. Listing text:
  `docs/daybloom_store-listing_v1.md`.
- **Package name** is `online.draran.daybloom` in `app.json`. It cannot be changed after the first
  Play Store upload, so confirm it now.
- **Privacy policy URL** for the Play listing: `https://arancastro.github.io/privacy/`.
- **Data safety form**: the app collects no personal data on a server. The only network call is
  the one-line nudge to ntfy.sh, which contains the user's first name.
- **Contacts permission** (`READ_CONTACTS`) is declared for the contact picker only; `WRITE_CONTACTS`
  is blocked in `app.json`. Declare "Contacts: read, stored on device, not shared" in the form.

## How the nudge is delivered

The buddy installs the free **ntfy** app (Android and iOS) and subscribes to a random topic
created by this app (for example `nudge-85lixtexkrag`). The invite link opens
`https://arancastro.github.io/join/`, which walks them through it. When the low-day rule is met,
the app sends one HTTPS POST to `https://ntfy.sh`. No account and no server of our own is involved.

The rule lives in `src/lib/nudge-rule.ts`:

- the most recent N check-ins are all Low or Heavy;
- the newest one is today;
- they span at most N + 1 calendar days (one missed tap is tolerated).

After one nudge the rule is disarmed until a day that is Okay or better.

## Project layout

```
src/app/                  screens (Expo Router)
  onboarding.tsx          five-step first run
  (tabs)/today.tsx        mood check-in, focus list, week strip, support card
  (tabs)/matrix.tsx       Eisenhower matrix (2 × 2 quadrant cards, add button)
  quadrant/[q].tsx        one quadrant in full, with completed tasks and Arrange (up/down)
  calendar.tsx            month calendar of due tasks; tasks, mood and flowers for a chosen day
  (tabs)/journey.tsx      Garden tab: garden bed, ways to grow, collection, badges, mood journal
  (tabs)/play.tsx         Play: today's game pick and all four games
  game/[id].tsx           full-screen game (breathe, bubbles, memory, colours)
  (tabs)/circle.tsx       People: circle matrix, nudge buddy, invite, test nudge
  settings.tsx            name, reminder, threshold, privacy, erase (gear on Today)
  widgets.tsx             widget gallery: live previews and "Add to home screen"
  focus.tsx               Pomodoro timer, flower reward and Focus Garden
  badges.tsx              streak, rest days and badge collection
src/components/           design system: text, buttons, cards, icons, mood orb, tab bar
src/components/games/     the four games and their shared frame
src/widgets/              Android home-screen widgets: layouts, data, background tap handler, sync
src/lib/                  state store (moods, tasks), nudge rule, quadrants, ntfy client, reminders, dates
assets/images/            app icon, adaptive icon, splash
```

## Checks

```powershell
npm run typecheck
npm run lint
```

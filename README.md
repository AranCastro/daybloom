# Daybloom: Mood & Garden

*Grow a little every day.*

Website, privacy policy and a live web demo: https://arancastro.github.io/ (source in
[AranCastro/AranCastro.github.io](https://github.com/AranCastro/AranCastro.github.io)).

One calm app where everything you do grows the same garden:

- **Nudge a Friend.** Tap your mood once a day. After a set number of low days in a row (default three),
  the app offers to ask your buddy to call you. One tap opens SMS or WhatsApp with a short message ready;
  you press Send. The buddy is a contact you pick, or automatically the first person in your closest circle.
  They need no app and no invitation, and they never see your answers.
- **Eisenhower Matrix.** Sort tasks into Do first, Schedule, Delegate and Later, with due-date badges.
  Today's screen shows a short Focus list (due or late first, then Do first), reduced to one task on a low day.
  **Arrange** (in each quadrant, or Move up / Move down in a task) sets your own order; the widgets follow it.
  **Calendar** (icon on the Matrix tab): past days shaded from pale to deep green by productivity (tasks finished +
  focus sessions: 1, 2–3, 4–5, 6+), a dot per task due in quadrant colours; pick a day
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

- **Focus timer (Pomodoro)**, its own tab in the menu. Gentle 15/3, Classic 25/5 or Deep 50/10 (Gentle is suggested on a low day),
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

- **Settings.** Appearance (System, Light or Dark), vibration on or off, reduce motion (also saves battery),
  week starts on Sunday or Monday, and the usual focus session (15, 25 or 50 minutes), plus name, daily
  reminder, nudge threshold and home-screen widgets.

- **Profile and personalisation.** Settings → Profile: upload a photo (copied into the app's storage, not
  included in backups) or choose one of 12 avatars (eight garden flowers, four coloured initials); it shows beside
  the greeting on Today. Settings → Section names: rename the four matrix quadrants and the four circle
  sections (empty = the original name); the new names appear in the app and on the widgets. Home screen
  widgets → Widget theme: System, Light or Dark for every widget (the Matrix and People widgets can still
  have their own).

- **Backup and restore.** Settings → Backup and restore: **Back up to Google Drive** writes a backup file
  (JSON) and opens the share menu, where Drive can be chosen; **Restore from a backup** opens a backup file
  from Drive or the phone, shows what it contains and asks before replacing anything. **Weekly backup** (on
  by default) keeps a fresh backup in the app's storage every week (the last four are kept) and shows a
  "Save to Drive" card on Today. Android's own Google backup (`allowBackup`) also includes the app's data.
  Code: `src/lib/backup-core.ts` (file format and checks), `src/lib/backup.ts` / `backup.web.ts`,
  `src/components/backup.tsx`.

Moods, tasks, people, scores, focus sessions, badges and the garden are stored on the phone. They leave it only
in a backup file the user chooses to save, or through Android's own Google backup when that is switched on in
the phone's settings. The app itself sends nothing over the internet; the buddy message is sent by the user from SMS or WhatsApp.

Built with Expo SDK 57 (React Native 0.86, Expo Router, TypeScript).

## Run it on your phone (Windows, no Android Studio)

1. Install Node.js 22 LTS from https://nodejs.org and Git from https://git-scm.com.
2. In PowerShell:

   ```powershell
   git clone https://github.com/AranCastro/daybloom.git
   cd daybloom
   npm install
   npx expo start
   ```

3. Install **Expo Go** from the Play Store and scan the QR code shown in the terminal.

Everything in this app works in Expo Go (local notifications, haptics, SQLite storage, SVG, gradients,
contact picker) except the home-screen widgets, which need the APK (below).

WhatsApp links need an international number. A bare 10-digit number gets the country code of the phone's region
(India +91, US and Canada +1); elsewhere, save numbers with their country code (`src/lib/reach.ts`,
`src/lib/region.ts`). The Heavy-day helpline also follows the region: Tele-MANAS 14416 in India, findahelpline.com
elsewhere.

## Download a test APK (no setup needed)

Every change to the app on `main` is built automatically by GitHub Actions
(`.github/workflows/android-apk.yml`) and published as a release:

**https://github.com/AranCastro/daybloom/releases/latest**

Builds up to 1.3.3 were published from the website repository and remain at
https://github.com/AranCastro/AranCastro.github.io/releases.

Open that page on an Android phone, tap the `.apk`, and allow installing from the browser when asked.
To rebuild by hand: GitHub → **Actions** → **Build Android APK** → **Run workflow**. These test builds
are signed with a debug key; Play Store builds come from `eas build --profile production` (below).

## Web demo on the website

The live demo at https://arancastro.github.io/app/ is the web build of this app
(`experiments.baseUrl` is `/app` in `app.json`). To refresh it after changes:

```powershell
npx expo export --platform web
```

then copy the contents of `dist/` into the `app/` folder of the website repository.

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
- **Data safety form**: the app collects and shares no personal data. It makes no network calls of its own;
  the buddy message is sent by the user through SMS or WhatsApp.
- **Contacts permission** (`READ_CONTACTS`) is declared for the contact picker only; `WRITE_CONTACTS`
  is blocked in `app.json`. Declare "Contacts: read, stored on device, not shared" in the form.

## How the nudge is delivered

The buddy is a person in the circle: the one the user chose (from contacts or from the circle), or,
automatically, the first person in "Call anytime" (quadrant 1) who has a phone number. When the low-day
rule is met, the app shows a notification and a card on Today. One tap opens SMS or WhatsApp with a
short message ("Hi Amma, could you give me a call today when you have a moment?"); the user presses Send.
The message never mentions mood. No account, no server and nothing for the buddy to install.

The rule lives in `src/lib/nudge-rule.ts`:

- the most recent N check-ins are all Low or Heavy;
- the newest one is today;
- they span at most N + 1 calendar days (one missed tap is tolerated).

After one offer the rule is disarmed until a day that is Okay or better.

## Project layout

```
src/app/                  screens (Expo Router)
  onboarding.tsx          five-step first run
  (tabs)/today.tsx        mood check-in, focus list, week strip, support card
  (tabs)/matrix.tsx       Eisenhower matrix (2 × 2 quadrant cards, add button)
  (tabs)/focus.tsx        Focus tab: Pomodoro timer, flower reward and Focus Garden
  quadrant/[q].tsx        one quadrant in full, with completed tasks and Arrange (up/down)
  calendar.tsx            month calendar of due tasks; tasks, mood and flowers for a chosen day
  (tabs)/journey.tsx      Garden tab: garden bed, ways to grow, collection, badges, mood journal
  (tabs)/play.tsx         Play: today's game pick and all four games
  game/[id].tsx           full-screen game (breathe, bubbles, memory, colours)
  (tabs)/circle.tsx       People: circle matrix, buddy (chosen or automatic), nudge history
  settings.tsx            name, reminder, threshold, privacy, erase (gear on Today)
  widgets.tsx             widget gallery: live previews and "Add to home screen"
  badges.tsx              streak, rest days and badge collection
src/components/           design system: text, buttons, cards, icons, mood orb, tab bar
src/components/games/     the four games and their shared frame
src/widgets/              Android home-screen widgets: layouts, data, background tap handler, sync
src/lib/                  state store (moods, tasks), nudge rule, quadrants, reach (call/SMS/WhatsApp), reminders, dates
assets/images/            app icon, adaptive icon, splash
```

## Checks

```powershell
npm run typecheck
npm run lint
npm test          # unit tests (jest-expo): nudge rule and sequences, flowers, streaks, backups, tasks
```

The same three run on every pull request (`.github/workflows/checks.yml`).

## Signing the test APK with your own key

Until these repository secrets exist, the APK workflow signs with Expo's public debug key, which is fine for
trying the app but lets anyone build an APK that installs over a tester's copy. To use a private key:

```powershell
keytool -genkeypair -v -keystore daybloom-release.jks -alias daybloom -keyalg RSA -keysize 2048 -validity 10000
[Convert]::ToBase64String([IO.File]::ReadAllBytes("daybloom-release.jks")) | Set-Clipboard
```

Then in GitHub → daybloom → Settings → Secrets and variables → Actions, add `ANDROID_KEYSTORE_BASE64` (paste),
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`daybloom`) and `ANDROID_KEY_PASSWORD`. Keep the `.jks` file and
passwords safe: losing them means testers must uninstall to update. Testers on a debug-signed build must uninstall
once (make a backup first: Settings → Backup and restore).

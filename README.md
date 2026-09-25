# Nudge a Friend — mobile app

Two tools in one calm app:

- **Nudge a Friend.** Tap your mood once a day. After a set number of low days in a row (default three),
  one trusted friend receives a single line: "Call Aran today." They are never told why.
- **Eisenhower Matrix.** Sort tasks into Do first, Schedule, Delegate and Later, with due-date badges.
  Today's screen shows a short Focus list (due or late first, then Do first), reduced to one task on a low day.

- **Circle matrix.** Sort trusted people by closeness (close / wider) and how to reach them (call / message):
  Call anytime, Quick call, Message first, Light chat. On a Low or Heavy day, Today suggests one person to
  call and one to message (least recently reached first), with one-tap Call, SMS and WhatsApp.

Moods, tasks and people never leave the phone.

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
contact picker).

WhatsApp links need an international number. A bare 10-digit number is treated as Indian (+91); numbers
saved with a country code (for example +44 …) are used as they are (`src/lib/reach.ts`).

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

- **Package name** is `online.draran.nudge` in `app.json`. It cannot be changed after the first
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
  quadrant/[q].tsx        one quadrant in full, with completed tasks
  (tabs)/journey.tsx      month calendar and mood mix
  (tabs)/circle.tsx       People: circle matrix, nudge buddy, invite, test nudge
  (tabs)/settings.tsx     name, reminder, threshold, privacy, erase
src/components/           design system: text, buttons, cards, icons, mood orb, tab bar
src/lib/                  state store (moods, tasks), nudge rule, quadrants, ntfy client, reminders, dates
assets/images/            app icon, adaptive icon, splash
```

## Checks

```powershell
npm run typecheck
npm run lint
```

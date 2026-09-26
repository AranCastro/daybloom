# Daybloom: Publishing on Google Play (Guide v1)

This guide takes Daybloom 1.8.0 from GitHub to Google Play. Work through it in order.
Texts for the store listing and the Data safety answers are in `docs/daybloom_store-listing_v1.md`.

## Step 1. Add the upload key to GitHub (once)

The upload key signs every Play Store build. You received two files:
`daybloom_upload-key_v1.jks` (the key) and `daybloom_github-secrets_v1.txt` (its passwords).

1. Keep both files in two safe places (for example a private Google Drive folder and a USB drive).
   Do not share them or commit them to any repository.
2. Open github.com/AranCastro/daybloom → **Settings → Secrets and variables → Actions**.
3. Click **New repository secret** four times, copying each name and value from the `.txt` file:
   `ANDROID_KEY_ALIAS`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEYSTORE_BASE64`.

The test APKs are signed with this key from then on. Testers who installed an earlier test APK must uninstall it
once (make a backup first: Settings → Backup and restore) before installing a new one.

## Step 2. Build the Play Store bundle (.aab)

1. github.com/AranCastro/daybloom → **Actions → Build Play Store bundle → Run workflow → Run workflow**.
2. Wait about 15 minutes for a green tick. Open the run and download **daybloom-play-bundle** under Artifacts.
3. Unzip it. The file inside is `daybloom-1.8.0-vc13.aab`.

Every later upload needs a higher version code. Either raise `versionCode` in `app.json`, or type the next number
(14, 15, …) in the **versionCode** box when you click Run workflow.

## Step 3. Create the app in Play Console

Play Console → **Create app**:

| Field | Value |
|---|---|
| App name | Daybloom: Mood & Garden |
| Default language | English (United Kingdom) or English (India) |
| App or game | App |
| Free or paid | Free |
| Declarations | Tick both (Developer Programme Policies, US export laws) |

## Step 4. Set up the app (Dashboard → "Set up your app")

Complete each task on the dashboard:

| Task | Answer |
|---|---|
| Privacy policy | `https://arancastro.github.io/privacy/` |
| App access | All functionality is available without special access |
| Ads | No, the app does not contain ads |
| Content rating | Fill the questionnaire: category "All other app types"; answer No to violence, sexual content, gambling and similar questions. It allows users to interact: No |
| Target audience | 18 and over |
| News app | No |
| Data safety | Use the table in `daybloom_store-listing_v1.md`: no data collected, no data shared |
| Government app | No |
| Financial features | None |
| Health apps | Tick the mental and behavioural health / stress management option; state it is not a medical device |

## Step 5. Store listing (Grow users → Store presence → Main store listing)

| Item | File or text |
|---|---|
| App name, short and full description | `daybloom_store-listing_v1.md` |
| App icon (512 × 512) | `daybloom_play-icon_512.png` |
| Feature graphic (1024 × 500) | `daybloom_feature-graphic_1024x500.png` |
| Phone screenshots (1080 × 1920) | `daybloom_screenshot-1-today.png` to `-6-garden.png` |
| Category | Health & Fitness |
| Contact email | arancastro17@gmail.com |
| Website | https://arancastro.github.io |

## Step 6. Closed testing (required for new personal accounts)

Personal developer accounts created after November 2023 must run a closed test with at least 12 testers who stay
opted in for 14 days in a row before production access opens. Play Console shows this requirement on the
Dashboard; check the current numbers there.

1. **Test and release → Testing → Closed testing → Create track** (or use the default "Alpha").
2. **Testers:** create an email list with at least 12 Gmail addresses (colleagues, students, family).
3. **Create new release:**
   - Play App Signing: accept "Use Google-generated key" (recommended). Your key stays the upload key.
   - Upload `daybloom-1.8.0-vc13.aab`.
   - Release name: `1.8.0`. Release notes: "First release of Daybloom: mood check-in, Eisenhower Matrix, focus
     timer, calm games, circle of people and a buddy nudge."
4. **Countries:** India (add others later if wanted).
5. **Review release → Start rollout.** Google's review of the first release can take several days.
6. Share the opt-in link from the track's **Testers** tab. Each tester opens it, taps **Become a tester**, then
   installs from Play. They must stay opted in for the full 14 days.

## Step 7. Apply for production

After 14 days: **Dashboard → Apply for production**. Answer the questions about the test (how testers were found,
feedback received, changes made). After approval: **Production → Create new release**, upload a new bundle with a
higher version code, and roll out.

## Updating the app later

1. Change the code and raise `version` (for example 1.8.1) and `versionCode` in `app.json`.
2. Run **Build Play Store bundle**, then upload the `.aab` as a new release in the same track.

## If the upload key is lost

Play Console → **Setup → App integrity → App signing → Request upload key reset**. Google verifies the account
owner and registers a new upload key. The app itself stays the same, because Google holds the app signing key.

# Daybloom: Mood & Garden (formerly Nudge a Friend): Product Analysis and Development Plan

**Version:** 1.0 (25 September 2026)
**Author:** Dr Aran Castro
**Status:** Version 1 of the Android/iOS app built and tested in this repository; Play Store release pending.

---

## 1. Summary

Daybloom is a mobile application whose core feature, Nudge a Friend, asks the user one question a day, "How does today feel?", answered with a single tap on a five-point scale (Bright, Good, Okay, Low, Heavy). When the user records a set number of consecutive low days (default three), one trusted person chosen by the user receives a single notification: "Call Aran today." The buddy is not told the reason and never sees the mood record. All mood data remain on the user's phone.

The product addresses a specific behavioural gap: people in distress are the least likely to ask for help, while the people close to them would act if they knew. The application converts a private signal into a minimal, privacy-preserving prompt to a person who already cares about the user.

## 2. Problem and Evidence

Suicide caused an estimated 727 000 deaths worldwide in 2021, and more than half occurred before the age of 50 (World Health Organization [WHO], 2025) [VERIFICATION NEEDED: figures to be checked against the current WHO fact sheet]. Low help-seeking is a documented barrier: a systematic review of 22 studies of adolescents and young adults identified stigma and embarrassment, poor recognition of symptoms, and a preference for self-reliance as the principal perceived barriers, and identified social support and encouragement from others as facilitators (Gulliver et al., 2010).

In India, the National Mental Health Survey 2015–16 reported a treatment gap of 70–92% across mental disorders (Gururaj et al., 2016) [VERIFICATION NEEDED: range to be checked against the NIMHANS summary report]. The Government of India launched the Tele-MANAS helpline (14416) in October 2022 to widen access; the app links to this helpline whenever a user records a Heavy day.

Two lines of evidence support contact-based prevention. A meta-analysis of 148 studies (n = 308 849) reported a random-effects weighted odds ratio of 1.50 (95% CI 1.42–1.59) for survival among participants with stronger social relationships (Holt-Lunstad et al., 2010). In a randomised controlled trial, 843 patients who had refused ongoing care after hospitalisation for a depressive or suicidal state were allocated either to receive brief contact letters at least four times a year for five years or to receive no further contact; the contact group had a significantly lower suicide rate during the first two years (survival analysis, p = .04), and the difference diminished thereafter (Motto & Bostrom, 2001). Later trials of caring contacts have produced mixed results, and a systematic review and meta-analysis of six randomised trials (6 218 participants) reported summary risk ratios between 0.57 and 1.29 across outcomes, with a protective effect observed for suicide attempts at one year (Skopp et al., 2022). Nudge a Friend applies the same principle of low-demand contact, with the contact coming from someone the user already trusts rather than from a clinical service; its effect has not been tested and should not be claimed.

## 3. Concept

| Element | Design decision | Reason |
|---|---|---|
| Input | One tap per day, five moods, no text | Minimum effort sustains daily use; no writing avoids journaling fatigue |
| Trigger | N consecutive Low/Heavy days (N = 2, 3 or 4; default 3) | A single bad day is normal; a run of low days is a meaningful signal |
| Tolerance | One skipped day inside the run is allowed | A missed tap should not reset a genuine low period |
| Recipient | One buddy chosen by the user | Keeps the social cost of joining low and the message personal |
| Message | "Call [name] today" and nothing else | The buddy acts without the user's privacy being breached |
| Frequency | One nudge per low period; reset by an Okay-or-better day | Prevents repeated alerts and buddy fatigue |
| Crisis path | Tele-MANAS 14416 and 112 shown on Heavy days and in Settings | The app is not a crisis service and must say so |

*Table 1. Core design decisions.*

## 4. Existing Solutions

| Category | Examples | Gap relative to Daybloom's Nudge a Friend |
|---|---|---|
| Mood trackers | Daylio, Bearable, How We Feel | Data stay with the user; no one is told |
| Check-in / "are you alive" apps | Daily safety check-in apps for people living alone | Alert on *no response*, not on low mood; alerts usually disclose the reason |
| Crisis helplines | Tele-MANAS, NGO helplines | Require the distressed person to initiate contact |
| Peer-support platforms | 7 Cups and similar | Contact with strangers, not with the user's own people |

*Table 2. Comparison with existing categories (author's assessment; a formal app-store and literature search is recommended before public claims of novelty [VERIFICATION NEEDED]).*

## 5. Version 1 Scope (Delivered)

| Area | Delivered in this repository |
|---|---|
| Onboarding | Five steps: welcome, how it works, user's name, buddy invitation, reminder time |
| Today screen | Mood picker with animated mood orbs, today's result, seven-day strip, buddy status, support card on Heavy days |
| Journey screen | Month calendar coloured by mood, check-in streak, monthly mood distribution |
| Buddy screen | Invite via WhatsApp/SMS share sheet, connection status, test nudge, nudge history, change buddy |
| Eisenhower Matrix | Four quadrant cards (Do first, Schedule, Delegate, Later) with task counts and due badges (Today, 1D, 3D, late); add/edit sheet with quadrant and due-date choice; full quadrant view with completed tasks |
| Focus today | On the Today screen: tasks due today or late (any quadrant), then Do first; reduced to one task when today's mood is Low or Heavy |
| Circle matrix | People sorted by closeness (close / wider) and contact mode (call / message): Call anytime, Quick call, Message first, Light chat; add from the phone's contact picker or by hand; one-tap Call, SMS and WhatsApp with a neutral opener |
| Reach out today | On a Low or Heavy day, Today suggests one person to call and one to message, least recently reached first |
| Play | Four short games matched to today's mood: Breathe (Heavy; three paced-breathing rhythms with a progress ring), Bubble Pop (Low; untimed Zen mode or a 60 s dash), Pair Up (Okay; memory game at three levels with star rating), Colour Clash (Good or Bright; 30 s word-colour interference task with streak multipliers). Shared results screen, countdown and particle effects. Best scores kept on the device |
| Focus timer | Pomodoro presets Gentle 15/3, Classic 25/5, Deep 50/10; optional link to a Matrix task; pause, resume, stop; end-time storage so the timer survives the app closing; alarm notification; screen kept awake |
| Unified garden (reward) | Every activity grows a flower in one garden: daily check-in, finished task (removed if unticked), focus session, first finish of each game per day, reaching out (once a day), each badge (always rare). 12 kinds (7 common, 4 rare, Golden Lotus every 20th bloom). Global bloom toast; Garden tab replaces Journey |
| Streak and badges | Check-in streak with one forgiven rest day after every 7 check-ins; best streak; 12 bronze, silver and gold badges (streak milestones, days noted, Honest day, Welcome back); celebration on earning; badges kept after a streak ends |
| Settings | Name, daily reminder (on/off, time), nudge threshold, privacy summary, helpline, privacy policy, erase all data |
| Nudge delivery | HTTPS publish to ntfy.sh with automatic retry when offline |
| Buddy onboarding | Web page `arancastro.github.io/join/` (install ntfy, subscribe, confirm "I'm in") |
| Design | Custom design system: Fraunces and Manrope typefaces, warm neutral palette, light and dark themes, haptics, spring animations, custom icon set and app icon |
| Platform | Expo SDK 57, React Native 0.86, TypeScript; Android package `online.draran.daybloom` |

*Table 3. Features in version 1.*

Verification carried out: TypeScript type-check and ESLint pass with no errors. An automated browser test completed the onboarding flow, seeded two prior low days, recorded a third, and confirmed that exactly one nudge was published with the payload `"Call Aran today"` (no mood data), that a further low entry on the same day produced no second nudge, and that the buddy's confirmation was detected.

### 5.1 Why the matrix belongs in the same app

The Eisenhower Matrix sorts tasks by urgency and importance. Placing it beside the mood check-in lets the app adapt the day's workload to the day's state: on a Low or Heavy day the Focus list shows a single task instead of three. Task data follow the same rule as mood data and remain on the device. The combination also gives users a daily reason to open the app on good days, which keeps the check-in habit alive for the days when the nudge matters.

### 5.2 The circle matrix

The nudge relies on one buddy noticing. The circle matrix adds a second route that the user controls: on a low day the app proposes a specific person and a specific action, which removes the decision of whom to contact at the moment when decisions are hardest. Gulliver et al. (2010) identified social support and encouragement from others as facilitators of help-seeking; the matrix makes that support visible and one tap away. Suggestions rotate by the date each person was last reached, so the same friend is not asked every time. Pre-written openers ("Hey, thinking of you. How have you been?") contain no reference to mood, so the user decides how much to share.

### 5.3 Mood-matched games

The Play tab offers one game chosen from today's check-in. The pairing follows task demand: the lower the mood, the lower the effort asked. Heavy days get a paced-breathing exercise with nothing to win; Low days get an untimed bubble game with no failure state; Okay days get a short memory game; Good and Bright days get a timed word-colour interference task in the style of the Stroop test. No therapeutic effect is claimed for any game; they are presented as short breaks, and any such claim would need a controlled evaluation.

### 5.4 Why one garden

Each feature previously had its own reward. A single garden turns every small action into visible, cumulative progress in one place, so the app reads as one product rather than a set of tools. The limits (one check-in flower a day, one per game a day, one reach-out a day, task flowers withdrawn if a task is unticked) keep the garden a record of real activity rather than something to farm.

## 6. Architecture

```
 User's phone                                  Buddy's phone
 ┌───────────────────────────┐                ┌──────────────────┐
 │ Daybloom app              │   HTTPS POST   │ ntfy app         │
 │  • moods (SQLite, local)  │ ─────────────► │  subscribed to   │
 │  • nudge rule             │   ntfy.sh      │  nudge-xxxxxxxx  │
 │  • daily local reminder   │ ◄───────────── │                  │
 └───────────────────────────┘  "joined" ack  └──────────────────┘
                                   ▲
                    arancastro.github.io/join/ (static page)
```

*Fig. 1. Data flow. No server is operated by the project; the only external service is ntfy.sh.*

Design rationale: a server-less first version has no hosting cost, no user database to secure, and a short privacy policy, which simplifies Play Store review for a mental-health-adjacent app.

Known limitation: because there is no server, the app cannot detect *silence* (a user who stops checking in during a bad period). This is addressed in Phase 2.

## 7. Safety, Privacy and Ethics

1. **Not a medical service.** The app states this on the home page, in Settings and in the privacy policy, and presents Tele-MANAS (14416) and 112.
2. **Minimum disclosure.** The nudge contains only the user's first name. Mood values never leave the device.
3. **Consent of the buddy.** The buddy must install ntfy and subscribe; no message reaches anyone who has not opted in.
4. **Contacts.** The app reads only the single contact the user picks; `WRITE_CONTACTS` is blocked, and circle data never leave the device.
5. **Misuse.** A controlling partner could pressure a user to name them as buddy. The user can change or remove the buddy at any time without the buddy being notified.
6. **Topic security.** Topics are random 12-character codes (about 62 bits of entropy). Anyone holding the code could post to it; Phase 2 moves to authenticated delivery.
7. **Clinical review.** Before public launch, the wording of all prompts and the support card should be reviewed by a qualified mental-health professional.

## 8. Roadmap

| Phase | Timeline | Scope |
|---|---|---|
| 1. Private beta | Weeks 1–4 | EAS preview build (APK) to 20–30 volunteers; fix issues; clinical wording review |
| 2. Play Store launch | Weeks 5–8 | Production build (AAB), store listing, closed testing track (Google requires testing with testers before production for new personal developer accounts), public release |
| 3. Reliability | Months 3–4 | Small backend (e.g., Supabase or Firebase): silence detection ("no check-in for 3 days"), push delivery to a companion buddy view without ntfy, encrypted backup |
| 4. Reach | Months 5–6 | Malayalam, Tamil, Hindi and other Indian languages; up to three buddies; home-screen widget for one-tap check-in |
| 5. Institutions | Month 6+ | Opt-in version for colleges and hostels, where a trained counsellor is the buddy |

*Table 4. Development roadmap.*

## 9. Play Store Launch Checklist

- [ ] Google Play developer account (one-time registration fee, USD 25)
- [ ] Confirm package name `online.draran.daybloom` (cannot be changed after first upload)
- [ ] `eas build -p android --profile production` to produce the `.aab`
- [ ] Store listing (text drafted in `docs/daybloom_store-listing_v1.md`): title "Daybloom: Mood & Garden", short description, full description, 2–8 phone screenshots, 512 × 512 icon, 1024 × 500 feature graphic
- [ ] Privacy policy URL: `https://arancastro.github.io/privacy/`
- [ ] Data safety form: no data collected by the developer; first name sent to ntfy.sh for app functionality
- [ ] Content rating questionnaire; declare health-related features accurately
- [ ] Closed testing with the required number of testers before applying for production access
- [ ] Merge this branch so that `/join/` and `/privacy/` are live before release

## 10. Cost Estimate

| Item | Cost |
|---|---|
| Google Play registration | USD 25, one time |
| Expo EAS builds | Free tier (limited monthly builds); paid plans optional |
| ntfy.sh delivery | Free public service; self-hosting possible later |
| Website (GitHub Pages) | Free |
| Apple App Store (optional, later) | USD 99 per year |

*Table 5. Launch costs for version 1.*

## 11. Success Measures

| Measure | Target after 3 months |
|---|---|
| Users completing onboarding with a connected buddy | ≥ 60% |
| Users checking in on ≥ 4 days per week (week 4) | ≥ 40% |
| Buddies reporting they called after a nudge (in-app survey, Phase 3) | ≥ 70% |
| Play Store rating | ≥ 4.5 |

*Table 6. Proposed success measures. These are planning targets, not observed values.*

## 12. Scope for Future Work

A controlled pilot with a college counselling centre could test whether buddy nudges increase help-seeking contacts compared with mood tracking alone. Such a study would require institutional ethics approval, informed consent from both users and buddies, and pre-registered outcome measures.

---

## References

Gulliver, A., Griffiths, K. M., & Christensen, H. (2010). Perceived barriers and facilitators to mental health help-seeking in young people: A systematic review. *BMC Psychiatry, 10*, 113. https://doi.org/10.1186/1471-244X-10-113

Gururaj, G., Varghese, M., Benegal, V., Rao, G. N., Pathak, K., Singh, L. K., et al. (2016). *National Mental Health Survey of India, 2015–16: Summary* (NIMHANS Publication No. 128). National Institute of Mental Health and Neuro Sciences.

Holt-Lunstad, J., Smith, T. B., & Layton, J. B. (2010). Social relationships and mortality risk: A meta-analytic review. *PLoS Medicine, 7*(7), e1000316. https://doi.org/10.1371/journal.pmed.1000316

Motto, J. A., & Bostrom, A. G. (2001). A randomized controlled trial of postcrisis suicide prevention. *Psychiatric Services, 52*(6), 828–833. https://doi.org/10.1176/appi.ps.52.6.828

Skopp, N. A., et al. (2022). Caring contacts for suicide prevention: A systematic review and meta-analysis. *Psychological Services*. [Full author list, volume, pages and DOI not verified in this session.]

World Health Organization. (2025). *Suicide* [Fact sheet]. https://www.who.int/news-room/fact-sheets/detail/suicide

*Reference check (25 September 2026): Gulliver et al. (2010), Holt-Lunstad et al. (2010), Motto and Bostrom (2001) and Skopp et al. (2022) were confirmed against the Consensus academic database, including the figures quoted above. The WHO fact sheet and the NIMHANS report could not be reached from the build environment and are flagged [VERIFICATION NEEDED].*

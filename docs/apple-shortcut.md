# Apple Health → Hevy Coach (free iOS Shortcut)

Websites can't read Apple Health directly, so a Shortcut on your iPhone sends a small
daily summary to the app: **steps**, **active energy** and **heart-rate samples**
(your AirPods record heart rate during workouts).

You need:
- your app URL, e.g. `https://your-app.vercel.app`
- your `HEALTH_INGEST_TOKEN` (from the app's environment variables)

## Build the shortcut (about 10 minutes, once)

Open **Shortcuts** → **+** → name it "Coach Health Sync". Add these actions in order:

1. **Find Health Samples** → Type: **Steps**, Start Date: **is yesterday**.
   Then **Calculate Statistics** → **Sum** of Health Samples → rename the variable to `Steps`.
2. **Find Health Samples** → Type: **Active Energy**, Start Date: **is yesterday**.
   Then **Calculate Statistics** → **Sum** → rename to `Energy`.
3. **Find Health Samples** → Type: **Heart Rate**, Start Date: **is in the last 2 days**.
4. **Repeat with Each** (item in Health Samples from step 3):
   - **Get Details of Health Sample** → **Start Date** → **Format Date** → Date Format: **ISO 8601**, Include Time: on → **Add to Variable** `HRDates`
   - **Get Details of Health Sample** → **Value** → **Add to Variable** `HRValues`
5. **Combine Text** `HRDates` with **New Lines** → rename to `HRDatesText`.
   **Combine Text** `HRValues` with **New Lines** → rename to `HRValuesText`.
6. **Date** → **Adjust Date**: subtract 1 day → **Format Date** custom format `yyyy-MM-dd` → rename to `Day`.
7. **Get Contents of URL**:
   - URL: `https://your-app.vercel.app/api/health`
   - Method: **POST**
   - Headers: `Authorization` = `Bearer YOUR_HEALTH_INGEST_TOKEN`
   - Request Body: **JSON** with fields:
     - `date` (Text) → `Day`
     - `steps` (Number) → `Steps`
     - `activeEnergy` (Number) → `Energy`
     - `hrDates` (Text) → `HRDatesText`
     - `hrValues` (Text) → `HRValuesText`

Run it once by hand. The response should look like
`{"ok":true,"date":"…","steps":8412,"heartRateSamples":312}`.
iOS will ask you to allow Health access the first time.

## Run it automatically every morning

Shortcuts → **Automation** → **+** → **Time of Day** → 7:00 → Daily →
**Run Immediately** (turn off "Notify When Run" if you like) → pick "Coach Health Sync".

## What the app does with it
- **Steps:** your 7-day average nudges daily calories (±250 kcal max) around a 5,000-step baseline.
- **Heart rate:** on circuit days it counts minutes at or above 70% of your age-predicted max (about 132 bpm at 27). The goal is 15+ minutes.
- **Active energy:** stored for later. It isn't used for calories, because watch and earbud burn estimates are often well off.

Numbers formatted for your locale (e.g. `8,412`) are handled. Sending the same day twice just overwrites it.

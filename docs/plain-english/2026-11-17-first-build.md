# First build of Hevy Coach (17 Nov 2026)

### In one sentence
The first full version of your coaching app now exists: it reads your Hevy workouts and tells you each day whether to train, what to train, and what to eat. It isn't online yet.

### What changed (in plain English)
- **You'll log in with one password.** A wrong password gets rejected.
- **You'll open a "Today" screen** that says train or rest, which session (Upper A, Upper B, Legs or Circuit), and why. It lists your exercises with target weights and reps, taken from the lifts you actually do most.
- **You'll see your food targets for the day:** calories plus protein, carbs and fat. They're higher on gym days and lower on rest days. A **"Generate today's plan"** button asks Claude to write a short note and 3 meal ideas using rice, pork, eggs and veg.
- **You'll do a 10-second daily check-in** (sleep, soreness, energy) and a **weekly weigh-in**. A bad check-in can turn a training day into a rest day.
- **You'll see a "Sources" list** for every rule the app used, so you can see the research behind each number.
- **Your iPhone can send steps, active calories and heart rate** to the app through a free Apple Shortcut. On circuit days the app checks whether you spent 15+ minutes working hard enough.

### Why it works this way
- **4 visits a week, upper first:** you chose 2 upper, 1 legs (just keeping them), 1 circuit.
- **Plain rules do the maths, not AI:** you wanted every number backed by research. Claude only writes the readable text, and only when you press the button.
- **Week 1 is a lighter week (deload)** to break your plateau: half the sets at about 90% of the weight (Bell et al. 2023).
- **Add weight once you hit the top of your rep range:** compound lifts 6–10 reps, isolation lifts 10–15 (Schoenfeld et al. 2021).
- **Calories:** a standard formula for what your body burns at rest (Mifflin–St Jeor), plus your workouts and steps, plus +250 kcal for slow muscle gain. That works out to about **2,360 kcal on rest days and 2,790 on lifting days**. That's a little different from the earlier guesses of 2,450 / 2,750.
- **Protein: 1.8 g per kg, about 145 g a day.** The 1.6–2.2 g/kg range comes from Morton 2018. ISSN gives 1.4–2.0. 1.8 sits inside both.

### What was checked
- 28 automatic checks on the maths all pass, and the app builds without errors.
- It ran on a test computer against your real Hevy account and pulled in all **343 workouts**.
- Login, the daily check-in, the weigh-in and the Apple Health receiver were tried in a browser, and all worked.
- The Today screen showed **"Train: Upper A"** with your real exercises.

**Not tested yet:** the "Generate today's plan" button. There was no Anthropic key, and each use costs a little money. The Apple Shortcut hasn't been tried on a real iPhone either.

### What's not done yet / what you need to do
1. **Make the app's notebook:** sign up at turso.tech (free), create a database, and copy its `libsql://…` address and its token.
2. **Put the app online:** at vercel.com, click "Add New → Project" and import this repo. Add the settings listed in README.md: your Hevy key, an Anthropic key, your password, two random secret codes, and the two Turso values.
3. **Choose the right branch:** Vercel builds from the main branch, but this work is on `claude/confident-dirac-nnose6`. Either merge it into main first, or pick that branch in Vercel → Project Settings.
4. **In the app's Settings,** set your Phase 1 start date. That first week will be the lighter deload week.
5. **In Hevy,** go to Settings → Workouts, turn on RPE, and log it on your first 2–3 lifts.
6. **On your iPhone,** set up the Shortcut by following `docs/apple-shortcut.md`.

### Words you might see
- **API key:** a password that lets the app read your Hevy workouts.
- **Database:** the app's notebook, where it remembers your check-ins and weigh-ins.
- **Hosting / Vercel:** the computer on the internet that runs the app so your phone can open it.
- **Branch:** a separate draft copy of the app's files. "Merge" means folding the draft into the main copy.
- **Environment variables:** private settings (keys and passwords) you type into Vercel, not into the code.
- **Test:** an automatic check that the maths still gives the right answer.

# daily fitness · Demo 0.5

[English](README.en.md) · [简体中文](README.md) · [Download](https://github.com/losslesswow-tech/dailyfitness/releases/latest) · [Ideas & bugs](https://github.com/losslesswow-tech/dailyfitness/issues/new/choose)

An offline fitness calendar for Android and desktop browsers. Record exercise, meals, sleep and body measurements in one place, with a calm green interface and your records stored on your own device.

**Try it and help shape the next update.** Suggestions, bug reports and stories about how you use the app are welcome in English or Chinese through [GitHub Issues](https://github.com/losslesswow-tech/dailyfitness/issues/new/choose). Tell me what you want to do, what gets in your way and what would make it better. Please remove personal health data from anything you share.

## What's new in 0.5

- Add private foods with complete ingredients (including soy sauce, cooking oil and seasonings), a cooking method, finished portion weight and manually entered protein, carbs and fat.
- Calculate energy per 100 g using 4/4/9 kcal per gram, then add foods to meals by edible weight alongside official foods.
- Search, edit and delete private foods. Existing meals keep independent recipe and nutrient snapshots. Local JSON backups include the private library.
- Open **Profile → Private food library** or **Add meal → Estimate by food name → Add private food**. Ingredients record the recipe; they do not infer nutrients.
- Download the [0.5 release](https://github.com/losslesswow-tech/dailyfitness/releases/tag/v0.5.0), or build it with `npm run build:android`. See [0.5 notes](docs/releases/0.5.md).

## What's new in 0.4

- Switch between **简体中文** and **English** using the **语言 / Language** selector at the top of any screen. The first launch follows your system language; your choice is remembered.
- Navigation, forms, validation, built-in activities, equipment, meal types, exercises and calculation notes are localized. Switching preserves saved records and unsaved inputs on the current screen.
- USDA foods use their original English descriptions in English mode. TFDA foods keep their official Chinese names and source information. Custom names and notes are preserved.
- English and Chinese project introductions, feedback templates and an in-app link to GitHub feedback.

## Install on Android

Download [dailyfitness-demo-0.5.apk](https://github.com/losslesswow-tech/dailyfitness/releases/download/v0.5.0/dailyfitness-demo-0.5.apk) from the [0.5 release](https://github.com/losslesswow-tech/dailyfitness/releases/tag/v0.5.0). Android 8.0 / API 26 or later is required; the target is API 35.

1. Transfer the APK to your phone and open it in your file manager.
2. Allow installation from that source if prompted, then install **daily fitness**. USB debugging is not required.
3. Enter body measurements or explore first. No sample health records are added.
4. Use the calendar to add exercise, meals and sleep. Start a split plan or the big three from Training.

0.5 uses the same package and demo signing certificate as 0.1–0.4, with a higher version code, so it can be installed over an earlier demo. Export a JSON backup before updating. Do not uninstall first if you want to keep local records. Older apps cannot read new backups containing private-food meals; keep an older backup if you need to roll back.

Each release includes `SHA256SUMS.txt`. On Windows, verify the download with `Get-FileHash <APK-path> -Algorithm SHA256`. This is a development-signed demo for sideloading, not a store release. Physical Samsung S24 installation, its keyboard and system file pickers have not been tested.

## Features

- Calendar with daily summaries, month navigation, editing and deletion.
- Cardio duration, distance/speed/pace conversion and activity-specific fields, including incline and pool lengths. One trip across the pool is one length; a round trip is two.
- Three- to six-day split plans with one muscle group per training day, exercise search and custom exercises, per-set weight/reps, warm-ups, exercise history, notes and a foreground rest timer. Unfinished workouts can be resumed.
- Dumbbells use the **combined weight**. Barbells use the combined plate weight on both sides, plus a separate bar weight (20 kg by default).
- Six meal types, manual nutrient entry and food estimates by edible weight. The offline catalog contains 10,316 foods from USDA and TFDA; records retain their nutrient snapshots and source versions.
- Sleep intervals assigned to the wake-up date, body measurement history, and 7/30/90/365-day trends.
- Estimated active exercise energy, counted once per strength session, with formulas and source information available in the interface.
- JSON backup export/restore and typed confirmation before clearing app records. English uses `CLEAR`; Chinese uses `清空`.

## Privacy and calculations

The Android app stores records in private local files with AtomicFile writes. The interface has no network permission. Source and feedback links open your external browser and do not upload health records. Submitting feedback requires internet access and a GitHub account. Browser records stay in that browser and do not synchronize automatically with Android; you can transfer a JSON backup manually.

Language is stored separately from health records and is retained when clearing or restoring records. Uninstalling or clearing system app storage removes local records. Export a backup first, and keep it private. Imports are validated before replacing data; backups are limited to 4 MB.

Manual nutrient entry and private foods use 4/4/9 kcal per gram of protein/carbs/fat. Official food estimates use the database's energy value. Adult basal metabolism uses Mifflin–St Jeor with a displayed ±10% reference range. Exercise energy uses the 2024 Adult Compendium for ages 19–59 and subtracts resting expenditure from the main active-energy total. These are estimates, not wearable measurements, total daily expenditure or intake targets.

Food snapshots retain the [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets/) and [TFDA dataset](https://data.gov.tw/dataset/8543) provenance. USDA data is public domain / CC0; TFDA data uses the [Open Government Data License, version 1.0](https://data.gov.tw/license). Source agencies do not endorse this app. See the detailed [food data notes](docs/食物数据说明.md) and [exercise energy notes](docs/运动消耗估算说明.md), currently in Chinese.

## Run in a desktop browser

Install Node.js, then run:

```sh
npm install
npm start
```

Open [the local preview](http://127.0.0.1:4173). The server listens on this computer only.

```sh
npm test
npx playwright install chromium
npm run test:ui
```

Validation includes 41 logic tests and 38 browser tests, covering private recipes, gram scaling, historical snapshots, backup recovery, failed saves, Chinese/English flows and narrow layouts. Browser tests do not replace physical Android testing.

To build an APK on Windows, run `powershell -ExecutionPolicy Bypass -File scripts/setup-android.ps1`, then `npm run build:android`. Portable tools stay in `.tools/`; builds and the local demo signing key stay outside Git. A local build creates its own key unless you already have one, so it will not necessarily install over the distributed APK.

## Releases and current scope

[0.5](https://github.com/losslesswow-tech/dailyfitness/releases/tag/v0.5.0) · [0.4](https://github.com/losslesswow-tech/dailyfitness/releases/tag/v0.4.0) · [0.3](https://github.com/losslesswow-tech/dailyfitness/releases/tag/v0.3.0) · [0.2](https://github.com/losslesswow-tech/dailyfitness/releases/tag/v0.2.0) · [0.1](https://github.com/losslesswow-tech/dailyfitness/releases/tag/v0.1.0)

`main` contains current source; `v0.3.0`, `v0.4.0` and `v0.5.0` retain their respective full snapshots. 0.1 and 0.2 are historical APK and release-note archives; their complete source snapshots were not retained. Download their release APK assets to install them.

This demo uses local HTML/CSS/JavaScript in a Java Android WebView shell. The planned Kotlin/Compose/Room app is not implemented. There are no background reminders, cloud sync, wearable integration, automatic weight recommendations or predefined per-day exercise templates. The [Chinese planning notes](docs/产品与开发规划.md) describe the longer-term direction.

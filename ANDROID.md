# Packaging MyDorm as an Android app

The web app is already a working PWA (manifest, icons, service worker — see
`public/manifest.json`, `public/sw.js`, `components/ServiceWorkerRegistrar.tsx`).
This doc covers the next step: wrapping it in a **Trusted Web Activity (TWA)**,
Google's sanctioned way to ship a PWA as a real Android app, using
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap). No UI rewrite, no
second codebase — the Android app just opens your live site full-screen inside
Chrome's engine.

This is **run on your own machine**, not something I can do from here — it
needs a JDK, the Android SDK, and a signing keystore only you should hold.

## Prerequisites

- **Node.js** (already have it, for Bubblewrap's CLI)
- **JDK 17+** — `brew install openjdk@17` on macOS, or download from Adoptium
- Bubblewrap downloads its own Android SDK/build tools on first run — no
  separate Android Studio install required
- Your production domain serving **HTTPS** (confirmed already on)

## 1. Install Bubblewrap

```bash
npm install -g @bubblewrap/cli
```

## 2. Initialize the project

Run this from an empty folder **outside** this repo (it's a separate Android
project, not part of the Next.js app):

```bash
mkdir ~/mydorm-android && cd ~/mydorm-android
bubblewrap init --manifest=https://yourdomain.com/manifest.json
```

Replace `yourdomain.com` with your real production domain. Bubblewrap reads
your existing manifest and pre-fills most answers. When prompted:

- **Package name**: reverse-domain style, e.g. `com.mydorm.app` — this is a
  **permanent** identifier; once published to the Play Store it can never be
  changed for that listing.
- **App name / short name**: MyDorm
- **Signing key**: choose **"Create new"** the first time. You'll set a
  keystore password and key password — Bubblewrap saves the keystore as
  `android.keystore` in this folder.

> **Back up `android.keystore` somewhere safe immediately** (password manager,
> encrypted drive). If you lose it, you **permanently** lose the ability to
> publish updates to the same Play Store listing — there is no recovery, and
> Google has no way to reissue it. Never commit it to git.

## 3. Verify ownership with Digital Asset Links

This step tells Chrome "this Android app and this website are the same
owner," which is what makes the app open full-screen with **no address bar**.
Without it, the app still works, just shows a browser toolbar.

Get your signing key's SHA-256 fingerprint:

```bash
keytool -list -v -keystore android.keystore -alias android -storepass <your keystore password>
```

Copy the `SHA256:` fingerprint (looks like `14:6D:E9:...`), then create this
file in the **main repo** (not the Android project):

`public/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.mydorm.app",
    "sha256_cert_fingerprints": ["14:6D:E9:...replace with your real fingerprint..."]
  }
}]
```

It's a static file, served automatically by Next.js's existing `public/`
handling — no `server.js` changes needed. Commit it, redeploy, then confirm
it's reachable at `https://yourdomain.com/.well-known/assetlinks.json`.

## 4. Build

Back in the `~/mydorm-android` folder:

```bash
bubblewrap build
```

This produces:

- `app-release-signed.apk` — a directly installable APK
- `app-release-bundle.aab` — the format the Play Store requires for upload

## 5. Publish the APK for direct download (the login-page link)

The login page already has a **"Download the Android app (APK)"** link
pointing at `/downloads/mydorm.apk`. To make it live:

```bash
cp ~/mydorm-android/app-release-signed.apk /path/to/meal-main/public/downloads/mydorm.apk
```

Commit and deploy that file like any other static asset. Since it's signed
with your real keystore (not a Play Store debug build), it installs
normally — Android will still show an "install from unknown sources" warning
for anything not from the Play Store, which is expected for direct APK
downloads.

**Updating this file later**: only needed if the manifest itself changes
(icon, app name, package name). Ordinary feature/bug-fix updates to the web
app need **no** APK rebuild — the installed app just opens the live site,
which is already updated the moment you deploy.

## 6. Publish to the Play Store (optional, separate from step 5)

1. Create a [Google Play Developer account](https://play.google.com/console/signup)
   (one-time $25 fee; new accounts may need a day or two for identity
   verification).
2. Play Console → **Create app** → fill in name, category, free/paid.
3. Upload `app-release-bundle.aab` (the `.aab`, not the `.apk`) under
   **Production → Create release**.
4. Fill in: screenshots, short/full description, a **privacy policy URL**
   (required — the app collects phone numbers), content rating
   questionnaire, target audience.
5. Submit for review. Google's review typically takes **1–3 days**.

## Troubleshooting

- **App opens with a browser address bar instead of full-screen**: the
  `assetlinks.json` fingerprint doesn't match, or hasn't propagated yet
  (Chrome caches the verification result — try clearing Chrome's app data or
  wait a few minutes after first install).
- **"App not installed" on the phone**: usually a signature mismatch — if
  you're reinstalling over a previous install signed with a *different* key
  (e.g. a debug build), uninstall the old one first.
- **Camera (QR scanner) or microphone (Bangla voice input) not working
  inside the app**: these are standard Chrome permission prompts — same as
  the website, no extra Android permissions needed in the TWA manifest.

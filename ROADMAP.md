# LogPilot — GitHub, CI/CD & Installer Roadmap

Follow these steps **in order** after the prototype is working locally.

---

## Phase 1 — GitHub Repository Setup

- [ ] **1.1** Create a new GitHub repository at github.com/new
  - Name: `LogPilot`
  - Visibility: Public (required for free GitHub Actions minutes)
  - Do NOT initialize with README (we have one)

- [ ] **1.2** Initialize git locally and push
  ```bash
  git init
  git add .
  git commit -m "chore: initial LogPilot scaffold"
  git branch -M main
  git remote add origin https://github.com/YOUR_USERNAME/LogPilot.git
  git push -u origin main
  ```

- [ ] **1.3** Add a `.gitignore` (Node.js template) — exclude:
  - `node_modules/`
  - `dist/`, `dist-electron/`, `release/`
  - `.env`

---

## Phase 2 — Icon & Branding

- [ ] **2.1** Create a 256×256 `resources/icon.ico` (Windows icon)
  - Use any icon editor or convert a PNG using https://icoconvert.com
  - Place at `resources/icon.ico`

- [ ] **2.2** Optionally add `resources/icon.png` for Linux builds

---

## Phase 3 — GitHub Actions (Automated Builds)

The workflow file is already at `.github/workflows/release.yml`.

- [ ] **3.1** Go to your GitHub repo → **Settings → Actions → General**
  - Enable "Read and write permissions" under Workflow permissions

- [ ] **3.2** (Optional) Code signing — skip for first release, add later:
  - Set `CSC_LINK` and `CSC_KEY_PASSWORD` as GitHub Secrets for a `.p12` cert

- [ ] **3.3** Verify the workflow triggers correctly (see Phase 4)

---

## Phase 4 — Making Your First Release

- [ ] **4.1** Update the version in `package.json`:
  ```json
  { "version": "0.1.0" }
  ```

- [ ] **4.2** Commit and tag the release:
  ```bash
  git add package.json
  git commit -m "chore: bump version to 0.1.0"
  git tag v0.1.0
  git push origin main --tags
  ```

- [ ] **4.3** GitHub Actions will automatically:
  - Build the app on `windows-latest`
  - Package the NSIS installer (`LogPilot-Setup-0.1.0.exe`)
  - Create a GitHub Release with the installer attached

- [ ] **4.4** Go to your repo's **Releases** page and verify the installer is there

---

## Phase 5 — Auto-Update Setup

Auto-update is already wired via `electron-updater`.

- [ ] **5.1** In `package.json` build config, confirm:
  ```json
  "publish": { "provider": "github", "releaseType": "release" }
  ```

- [ ] **5.2** Each time you push a new version tag, users running older versions
  will be notified of the update on next launch

---

## Phase 6 — Future Enhancements

- [ ] Code signing certificate (removes Windows SmartScreen warning)
- [ ] Auto-update progress UI (download bar in the app)
- [ ] Mac / Linux builds (add `mac` and `linux` targets to electron-builder config)
- [ ] Color profile presets export/import UI
- [ ] Plugin system for custom log format parsers


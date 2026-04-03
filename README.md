# ✦ LogPilot

**High-performance log file organizer and viewer for Windows.**
Drag in any log file — LogPilot intelligently groups, sorts, and color-codes events so you can find what matters fast, even in files with 100,000+ entries.

---

## ✨ Features

### 📁 Multi-File Tabs
Open one or many log files at once — each gets its own tab. Switch between files instantly without losing scroll position, filters, or color assignments. Drag & drop files directly into the window.

### 🔍 Fuzzy Event Grouping
LogPilot uses a custom Levenshtein + template-normalization engine to detect similar repeating log lines and collapse them into a single group with an occurrence count badge. Noise is silenced automatically — you see patterns, not repetition.

### 📅 Date Bucketing
Log entries are automatically organized by date into collapsible day sections. Collapse an entire day to jump past bulk events. Right-click a date header to hide that day entirely from view.

### 🔀 Chronological View & Sorting
Switch between **Grouped view** (events organized by similarity and date) and **Chronological view** (every single log entry, sorted oldest → newest by timestamp). In Chronological view:
- The full log is always shown — no entries are hidden by significance filters
- Sorting is applied before any search or level filter, guaranteeing time-correct ordering
- A virtualized list renders only the visible rows, keeping navigation instant even for 100k+ entry files

### 🗺️ Minimap (Log Overview)
A VS Code-style minimap panel on the right edge gives you a 1,000-foot view of the entire log at a glance:
- Every group is drawn as a color-coded bar matching its log level (red = ERROR, yellow = WARN, green = INFO, blue = DEBUG)
- A semi-transparent viewport indicator shows exactly where you are in the file
- A bright marker highlights your currently selected entry anywhere in the full log
- **Click** anywhere on the minimap to jump instantly; **drag** to scrub through the log
- Updates in real time when switching between Grouped and Chronological view

### 🎨 Color Coding
Right-click any event group to assign a custom color. Colors are saved per-group across sessions — when you reopen the same log file, your highlights are exactly where you left them. Use colors to flag critical paths, infrastructure noise, or any pattern you care about.

### 🔎 Search & Level Filtering
Filter the visible log by:
- **Keyword search** — type anything to instantly narrow the view
- **Level toggles** — click ERROR / WARN / INFO / DEBUG / TRACE buttons in the toolbar to show or hide entire level categories
- Both filters compose and update the view without re-parsing the file

### ⇄ Correlation Tab
The Correlation panel is one of LogPilot's most powerful features for multi-file debugging. When you have two or more log files open:

1. **Select any event** in the active log — click a group row to select it
2. **The Correlation panel opens at the bottom** showing entries from all *other* open log files that occurred at the nearest matching timestamp
3. **Tab switching** — if you have 3 or more logs open, the correlation panel shows a tab per file so you can check each one independently
4. **Configurable window size** — control how many entries before and after the nearest timestamp are shown (the ±N context window)
5. **Nearest-match highlighting** — the entry with the closest timestamp to your selection is highlighted so it's immediately obvious where the two logs intersect

**Example use case:** You have an application log and a system/infrastructure log open side by side. You spot an ERROR in the app log. Click it — the Correlation tab instantly shows what the system was doing at that exact moment, letting you see if a disk event, network blip, or service restart coincided with the failure.

### 💾 Session Saving (.lfo)
Save your entire workspace as a `.lfo` file (plain JSON). Sessions store:
- All loaded file paths
- Color assignments per group
- Collapsed/expanded state for days and groups
- Hidden dates and groups
- Correlation window settings

Reopen a session and pick up exactly where you left off — even for complex multi-file investigations.

### 🔄 Auto-Update
LogPilot checks GitHub Releases on every launch. When a new version is available, it notifies you and can download and install the update in the background via the Windows NSIS installer integration.

---

## Dev Setup

```bash
# Install dependencies
npm install

# Start dev server (hot-reload)
npm run dev

# Build production app
npm run build

# Package Windows installer
npm run make
```

---

## Releases

Releases are automated via GitHub Actions. Every push of a version tag (e.g. `v0.2.0`) triggers a build on `windows-latest` that:
1. Builds and packages a Windows NSIS installer
2. Publishes the installer and update metadata to GitHub Releases
3. Makes the update available to all users running an older version via auto-update

To cut a new release:
```bash
# Bump version in package.json, then:
git add package.json
git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 31 |
| UI framework | React 18 + TypeScript |
| Styling | Tailwind CSS (dark theme) |
| State | Zustand |
| Build | electron-vite + Vite |
| Installer | electron-builder (NSIS) |
| Auto-update | electron-updater |
| Fuzzy match | Custom Levenshtein + template normalization |
| Virtual list | Custom windowed renderer (22px row height) |

---

## Supported Log Formats

`generic` · `json` / `ndjson` · `apache` · `nginx` · `python` · `syslog` · `log4j` · `windows-event`

---

## Session Files (.lfo)

LogPilot saves sessions as `.lfo` files (plain JSON).
They store: loaded file paths, color profiles, collapsed state, correlation settings, and recent sessions.

---

## License

MIT © LogPilot


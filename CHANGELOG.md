# Changelog

All notable changes to Overflow are listed here. Entries are written for people who use the app, not people who built it.

---

## 0.3.0 — 2026-03-20

### New
- **Album search.** A small magnifier icon sits at the top of the A–Z strip on the right edge of the screen. Click it (or press `/`) to open a search panel, type an artist or album name, and jump straight to it in the Cover Flow. Arrow keys navigate the results; Enter selects; Escape dismisses.

---

## 0.2.0 — 2026-03-20

### New
- **Native macOS app (Tauri).** Overflow now runs as a proper Mac app — no browser needed. It appears in the menu bar, supports the system tray, and feels like a native application.
- **Menu bar controls.** Play/Pause, Next, and Previous are available from the menu bar icon at any time, even when the window is hidden.
- **Keyboard media keys.** The Play/Pause, Next Track, and Previous Track keys on Apple keyboards are registered when the app is running.

### Improved
- **Window dragging.** The app window can be dragged from the title bar area. The macOS traffic-light buttons (close, minimise, fullscreen) no longer overlap the app content.
- **Text legibility.** All on-screen text is brighter and easier to read — contrast has been raised throughout to meet accessibility standards.
- **Cover Flow height.** The album artwork area now scales sensibly with the window size rather than being fixed at one height.
- **Focus indicators.** Keyboard users can now see clearly which button or control is focused.
- **Track rows and seek bar.** The track list and progress bar now work correctly with keyboard navigation and assistive technology.
- **Plex connection dialog.** The connection window now traps focus correctly, responds to the Escape key, and auto-focuses the first field when opened.

### Fixed
- Playing a new album no longer logs anything sensitive to the browser console.
- Selecting an album from a large Plex library (with non-numeric IDs) now generates the correct background colour tint.
- Switching to an album with fewer tracks than the previous one no longer gets stuck on a track index that doesn't exist.
- An empty Plex music library now shows a clear error message rather than silently doing nothing.

---

## 0.1.0 — 2026-02-14

### Initial release
- Cover Flow album browser with smooth, physics-driven scrolling — drag, scroll, or use the arrow keys.
- Connect to a local Plex Media Server to browse your real music library with album artwork.
- Play tracks directly from Plex with a progress bar and transport controls (Play, Pause, Previous, Next).
- A–Z scrubber on the right edge lets you jump to any letter of the alphabet instantly.
- Procedural album artwork as a fallback when no artwork is available from Plex.
- Detailed instructions inside the app for finding your Plex token.

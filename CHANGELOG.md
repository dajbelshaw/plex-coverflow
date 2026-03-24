# Changelog

All notable changes to Overflow are listed here. Entries are written for people who use the app, not people who built it.

---

## 1.5.0 — 2026-03-24

### Improved
- **Offline-ready fonts.** Playfair Display, DM Sans, and DM Mono are now bundled in the app rather than loaded from Google Fonts. Works without an internet connection.
- **Reduced motion support.** Users with "Reduce motion" enabled in macOS System Settings will see instant album transitions instead of the spring animation.
- **Background transitions are GPU-accelerated.** The album colour tint now fades via opacity rather than animating the background property directly, reducing repaint work.
- **Touch targets enlarged.** Shuffle, settings, and random album buttons all meet the 44px minimum interactive size.

### Fixed
- Album artwork images now have proper text descriptions for screen readers.
- The track shuffle button now correctly reports its on/off state to assistive technology.
- The settings button now announces whether the popover is open or closed.
- Search results are now proper interactive elements, accessible via keyboard Tab.
- The search palette now traps focus correctly — Tab no longer escapes to background controls.
- Arrow keys no longer move the Cover Flow carousel when a settings, search, or connect overlay is open.
- The A–Z scrubber no longer carries misleading ARIA roles that implied keyboard support it didn't have.
- All colour values now use the design token system consistently, fixing a class of invisible-element bugs.
- Seek bar now announces the current time as "M:SS of M:SS" to screen readers instead of a bare number.

---

## 1.4.2 — 2026-03-24

### Fixed
- Random album button next to the album counter was invisible due to an undefined colour value.

---

## 1.4.1 — 2026-03-24

### Improved
- **Smoother pause.** Music now fades out over 150ms when you pause or stop, instead of cutting off abruptly. Matches the feel of Winamp and Plexamp.

---

## 0.4.0 — 2026-03-24

### New
- **Settings menu.** A gear icon in the top-right opens a settings popover with a continuous play toggle and an after-album-ends mode (Next or Random). Settings persist across sessions.
- **Shuffle button.** A shuffle button below the transport controls jumps to a random album. Also triggered by pressing `r`.
- **Random album on connect.** The carousel opens on a random album each time you connect to Plex.
- **Window persistence.** Window size and position are remembered across launches.
- **Album art caching.** Album artwork is cached after the first load — subsequent visits are instant, even across restarts.

### Improved
- **Media key feedback.** If media key registration fails (Accessibility permission not granted), a toast message now explains what to do rather than silently failing.

---

## 0.3.1 — 2026-03-21

### Fixed
- Drag strip, icon visibility, and alignment polish.

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

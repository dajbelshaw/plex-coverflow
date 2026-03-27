use std::ffi::{CStr, CString, c_char, c_void};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter, Runtime};

// ── FFI: Swift @_cdecl exports ────────────────────────────────────────────────
#[cfg(target_os = "macos")]
extern "C" {
    fn media_plugin_register(
        context:  *const c_void,
        callback: extern "C" fn(*const c_void, *const c_char),
    );
    fn media_plugin_update_now_playing(
        title:       *const c_char,
        artist:      *const c_char,
        album:       *const c_char,
        duration:    f64,
        artwork_url: *const c_char,
    );
    fn media_plugin_set_playback_state(is_playing: bool);
}

// ── Global type-erased emitter (set once, used by the C callback) ─────────────
static EMITTER: OnceLock<Box<dyn Fn(&str) + Send + Sync>> = OnceLock::new();

#[cfg(target_os = "macos")]
extern "C" fn media_event_callback(_ctx: *const c_void, event_name: *const c_char) {
    if event_name.is_null() { return; }
    if let Ok(name) = unsafe { CStr::from_ptr(event_name) }.to_str() {
        if let Some(emit) = EMITTER.get() {
            emit(name);
        }
    }
}

/// Call once during `app.setup()`. Registers MPRemoteCommandCenter handlers.
pub fn register_media_commands<R: Runtime>(app: &AppHandle<R>) {
    #[cfg(target_os = "macos")]
    {
        let handle = app.clone();
        let _ = EMITTER.set(Box::new(move |event: &str| {
            handle.emit(event, ()).ok();
        }));
        unsafe {
            media_plugin_register(std::ptr::null(), media_event_callback);
        }
    }
}

// ── Tauri commands ─────────────────────────────────────────────────────────────

/// Update the tray tooltip/menu and MPNowPlayingInfoCenter.
#[tauri::command]
pub fn update_now_playing(
    app:         AppHandle,
    track:       String,
    artist:      String,
    album:       String,
    duration:    Option<f64>,
    artwork_url: Option<String>,
) {
    // Tray tooltip + menu (existing behaviour)
    if let Some(tray) = app.tray_by_id("main") {
        let tooltip = if track.is_empty() {
            "Overflow".to_string()
        } else {
            format!("{} — {}", track, artist)
        };
        let _ = tray.set_tooltip(Some(tooltip.as_str()));
        if let Ok(menu) = crate::build_tray_menu(&app, &track, &artist) {
            let _ = tray.set_menu(Some(menu));
        }
    }

    // MPNowPlayingInfoCenter
    #[cfg(target_os = "macos")]
    {
        let c_title  = CString::new(track.as_str()).unwrap_or_default();
        let c_artist = CString::new(artist.as_str()).unwrap_or_default();
        let c_album  = CString::new(album.as_str()).unwrap_or_default();
        let art      = artwork_url.unwrap_or_default();
        let c_art    = CString::new(art.as_str()).unwrap_or_default();
        unsafe {
            media_plugin_update_now_playing(
                c_title.as_ptr(),
                c_artist.as_ptr(),
                c_album.as_ptr(),
                duration.unwrap_or(0.0),
                c_art.as_ptr(),
            );
        }
    }
}

/// Notify macOS whether playback is active (keeps Now Playing HUD alive).
#[tauri::command]
pub fn set_playback_state(playing: bool) {
    #[cfg(target_os = "macos")]
    unsafe { media_plugin_set_playback_state(playing); }
}

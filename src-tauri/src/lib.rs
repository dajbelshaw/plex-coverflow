mod media_bridge;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

pub(crate) fn build_tray_menu<R: Runtime>(app: &AppHandle<R>, track: &str, artist: &str) -> tauri::Result<Menu<R>> {
    let label: String = if track.is_empty() {
        "Not playing".into()
    } else {
        format!("{} — {}", track, artist)
    };

    let info  = MenuItem::with_id(app, "info",       label,              false, None::<&str>)?;
    let sep1  = PredefinedMenuItem::separator(app)?;
    let play  = MenuItem::with_id(app, "play-pause", "Play / Pause",     true,  None::<&str>)?;
    let next  = MenuItem::with_id(app, "next",       "Next Track",       true,  None::<&str>)?;
    let prev  = MenuItem::with_id(app, "prev",       "Previous Track",   true,  None::<&str>)?;
    let sep2  = PredefinedMenuItem::separator(app)?;
    let show  = MenuItem::with_id(app, "show",       "Show Overflow",    true,  None::<&str>)?;
    let quit  = MenuItem::with_id(app, "quit",       "Quit",             true,  None::<&str>)?;

    Menu::with_items(app, &[&info, &sep1, &play, &next, &prev, &sep2, &show, &quit])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            // ── System tray ──────────────────────────────────────────────
            let menu = build_tray_menu(app.handle(), "", "")?;

            TrayIconBuilder::with_id("main")
                .tooltip("Overflow")
                .icon({
                    const RGBA: &[u8] = include_bytes!("../icons/tray.rgba");
                    tauri::image::Image::new(RGBA, 32, 32)
                })
                .icon_as_template(true)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "play-pause" => { app.emit("media-play-pause", ()).ok(); }
                    "next"       => { app.emit("media-next", ()).ok(); }
                    "prev"       => { app.emit("media-prev", ()).ok(); }
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            win.show().ok();
                            win.set_focus().ok();
                        }
                    }
                    "quit" => std::process::exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            win.show().ok();
                            win.set_focus().ok();
                        }
                    }
                })
                .build(app)?;

            // ── MPRemoteCommandCenter (media keys, no Accessibility needed) ──
            media_bridge::register_media_commands(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            media_bridge::update_now_playing,
            media_bridge::set_playback_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Overflow");
}

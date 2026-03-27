fn main() {
    #[cfg(target_os = "macos")]
    swift_rs::SwiftLinker::new("12.0")
        .with_package("MediaPlugin", "./swift-media")
        .link();
    tauri_build::build()
}

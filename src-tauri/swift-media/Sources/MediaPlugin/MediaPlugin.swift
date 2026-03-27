import AppKit
import Foundation
import MediaPlayer
import SwiftRs

// ── Callback stored from Rust registration call ───────────────────────────────
private var gCallback: (@convention(c) (UnsafeRawPointer?, UnsafePointer<CChar>?) -> Void)? = nil
private var gContext: UnsafeRawPointer? = nil

// ── Called once from Rust during app setup ────────────────────────────────────
@_cdecl("media_plugin_register")
public func mediaPluginRegister(
    context: UnsafeRawPointer?,
    callback: @escaping @convention(c) (UnsafeRawPointer?, UnsafePointer<CChar>?) -> Void
) {
    gCallback = callback
    gContext  = context

    let center = MPRemoteCommandCenter.shared()

    center.playCommand.isEnabled            = true
    center.pauseCommand.isEnabled           = true
    center.togglePlayPauseCommand.isEnabled = true
    center.nextTrackCommand.isEnabled       = true
    center.previousTrackCommand.isEnabled   = true

    // Disable commands we don't handle so macOS doesn't show them
    center.stopCommand.isEnabled            = false
    center.seekForwardCommand.isEnabled     = false
    center.seekBackwardCommand.isEnabled    = false

    center.playCommand.addTarget            { _ in fireEvent("media-play-pause"); return .success }
    center.pauseCommand.addTarget           { _ in fireEvent("media-play-pause"); return .success }
    center.togglePlayPauseCommand.addTarget { _ in fireEvent("media-play-pause"); return .success }
    center.nextTrackCommand.addTarget       { _ in fireEvent("media-next");       return .success }
    center.previousTrackCommand.addTarget   { _ in fireEvent("media-prev");       return .success }
}

private func fireEvent(_ name: String) {
    guard let cb = gCallback else { return }
    name.withCString { ptr in cb(gContext, ptr) }
}

// ── Update Now Playing info (track change) ────────────────────────────────────
@_cdecl("media_plugin_update_now_playing")
public func mediaPluginUpdateNowPlaying(
    title:      SRString,
    artist:     SRString,
    album:      SRString,
    duration:   Double,
    artworkUrl: SRString
) {
    var info: [String: Any] = [
        MPMediaItemPropertyTitle:                    title.toString(),
        MPMediaItemPropertyArtist:                   artist.toString(),
        MPMediaItemPropertyAlbumTitle:               album.toString(),
        MPNowPlayingInfoPropertyPlaybackRate:         1.0,
        MPNowPlayingInfoPropertyMediaType:
            MPNowPlayingInfoMediaType.audio.rawValue,
    ]
    if duration > 0 {
        info[MPMediaItemPropertyPlaybackDuration] = duration
    }

    let urlString = artworkUrl.toString()
    if !urlString.isEmpty, let url = URL(string: urlString) {
        URLSession.shared.dataTask(with: url) { data, _, _ in
            var updatedInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? info
            if let data = data, let image = NSImage(data: data) {
                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                updatedInfo[MPMediaItemPropertyArtwork] = artwork
            }
            DispatchQueue.main.async {
                MPNowPlayingInfoCenter.default().nowPlayingInfo = updatedInfo
            }
        }.resume()
    } else {
        DispatchQueue.main.async {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        }
    }
}

// ── Update playback state (play/pause) ────────────────────────────────────────
@_cdecl("media_plugin_set_playback_state")
public func mediaPluginSetPlaybackState(isPlaying: Bool) {
    DispatchQueue.main.async {
        MPNowPlayingInfoCenter.default().playbackState = isPlaying ? .playing : .paused
    }
}

// ── Clear Now Playing (disconnected / nothing loaded) ─────────────────────────
@_cdecl("media_plugin_clear")
public func mediaPluginClear() {
    DispatchQueue.main.async {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        MPNowPlayingInfoCenter.default().playbackState  = .stopped
    }
}

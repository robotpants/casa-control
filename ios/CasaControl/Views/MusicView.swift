import SwiftUI

struct MusicView: View {
    @EnvironmentObject private var spotify: SpotifyClient

    var body: some View {
        ZStack {
            Theme.Surface.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.s5) {
                    header
                    if spotify.isAuthenticated {
                        NowPlayingCard()
                        SectionLabel(text: "Quick Actions")
                        quickActions
                    } else {
                        connect
                    }
                    if let error = spotify.lastError {
                        Text(error)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Semantic.danger)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, Theme.Space.s6)
            }
        }
        .task {
            if spotify.isAuthenticated {
                await spotify.refreshNowPlaying()
                spotify.startPolling()
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Music")
                .font(Theme.Typography.h1)
                .foregroundStyle(Theme.TextColor.primary)
            Text("Spotify Connect")
                .font(Theme.Typography.sub)
                .foregroundStyle(Theme.TextColor.secondary)
        }
    }

    private var connect: some View {
        VStack(alignment: .leading, spacing: Theme.Space.s4) {
            Text("Connect Spotify")
                .font(Theme.Typography.h3)
                .foregroundStyle(Theme.TextColor.primary)
            Text("Sign in to control playback on your Spotify Connect devices. Premium required for playback control; now-playing read works on free.")
                .font(Theme.Typography.sub)
                .foregroundStyle(Theme.TextColor.secondary)
            Button {
                Task { await spotify.authenticate() }
            } label: {
                Text("Sign in with Spotify")
                    .font(Theme.Typography.sans(14, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(.white)
                    .background(Theme.Accent.ember, in: RoundedRectangle(cornerRadius: Theme.Radius.sm))
                    .shadow(color: Theme.Accent.glow, radius: 12, y: 4)
            }
            .buttonStyle(.plain)
        }
        .padding(20)
        .neuRaised()
    }

    private var quickActions: some View {
        HStack(spacing: Theme.Space.s3) {
            SceneChip(title: "Refresh", isActive: false) {
                Task { await spotify.refreshNowPlaying() }
            }
            SceneChip(title: "Sign out", isActive: false) {
                spotify.signOut()
            }
        }
    }
}

struct NowPlayingCard: View {
    @EnvironmentObject private var spotify: SpotifyClient

    var body: some View {
        VStack(spacing: Theme.Space.s4) {
            if let track = spotify.nowPlaying {
                HStack(spacing: Theme.Space.s4) {
                    albumArt(url: track.albumArtURL)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(track.title)
                            .font(Theme.Typography.sans(15, weight: .semibold))
                            .foregroundStyle(Theme.TextColor.primary)
                            .lineLimit(1)
                        Text(track.artist)
                            .font(Theme.Typography.sans(12))
                            .foregroundStyle(Theme.TextColor.secondary)
                            .lineLimit(1)
                        Text(track.album)
                            .font(Theme.Typography.sans(11))
                            .foregroundStyle(Theme.TextColor.muted)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
                progress(track: track)
                controls
            } else {
                Text("Nothing playing")
                    .font(Theme.Typography.sub)
                    .foregroundStyle(Theme.TextColor.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            }
        }
        .padding(18)
        .neuRaised()
    }

    private func albumArt(url: URL?) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Theme.Surface.surface)
                .frame(width: 64, height: 64)
            if let url {
                AsyncImage(url: url) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    Image(systemName: "music.note")
                        .foregroundStyle(Theme.TextColor.muted)
                }
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                Image(systemName: "music.note")
                    .foregroundStyle(Theme.TextColor.muted)
            }
        }
        .neuPressedSm(radius: 12)
    }

    private func progress(track: SpotifyTrack) -> some View {
        let p = max(0, min(1, Double(track.progressMs) / Double(max(1, track.durationMs))))
        return GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.Surface.surface).frame(height: 4).neuPressedSm(radius: 2)
                Capsule().fill(Theme.Accent.ember).frame(width: geo.size.width * p, height: 4)
            }
        }
        .frame(height: 4)
    }

    private var controls: some View {
        HStack(spacing: Theme.Space.s5) {
            Spacer()
            ctrlButton(systemName: "backward.fill") { Task { await spotify.previous() } }
            ctrlButton(systemName: (spotify.nowPlaying?.isPlaying ?? false) ? "pause.fill" : "play.fill",
                       size: .lg) { Task { await spotify.togglePlayPause() } }
            ctrlButton(systemName: "forward.fill") { Task { await spotify.next() } }
            Spacer()
        }
    }

    private func ctrlButton(systemName: String, size: IconWell.Size = .base, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            IconWell(systemName: systemName, size: size, on: true)
        }
        .buttonStyle(.plain)
    }
}

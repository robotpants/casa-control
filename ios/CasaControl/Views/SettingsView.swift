import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var spotify: SpotifyClient
    @EnvironmentObject private var hb: HomebridgeClient

    var body: some View {
        ZStack {
            Theme.Surface.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.s5) {
                    Text("Settings")
                        .font(Theme.Typography.h1)
                        .foregroundStyle(Theme.TextColor.primary)

                    section(title: "Integrations") {
                        row(icon: "music.note",
                            title: "Spotify",
                            subtitle: spotify.isAuthenticated ? "Connected" : "Not connected",
                            kind: spotify.isAuthenticated ? .ok : .info) {
                            if spotify.isAuthenticated { spotify.signOut() }
                            else { Task { await spotify.authenticate() } }
                        }
                        row(icon: "server.rack",
                            title: "Homebridge",
                            subtitle: hb.isAuthenticated ? "\(hb.host):\(hb.port)" : (hb.isConfigured ? "Signed out" : "Not configured"),
                            kind: hb.isAuthenticated ? .ok : .info) {
                            // No-op: configure via the Bridge tab. Action button just signs out.
                            if hb.isAuthenticated { hb.signOut() }
                        }
                    }

                    section(title: "About") {
                        row(icon: "info.circle",
                            title: "Casa Control",
                            subtitle: "iOS HomeKit client",
                            kind: .info) {}
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, Theme.Space.s6)
            }
        }
    }

    @ViewBuilder
    private func section<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.s3) {
            SectionLabel(text: title)
            VStack(spacing: Theme.Space.s2) {
                content()
            }
        }
    }

    private func row(icon: String, title: String, subtitle: String, kind: StatusKind, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Theme.Space.s3) {
                IconWell(systemName: icon, on: kind == .ok)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(Theme.Typography.sans(14, weight: .medium))
                        .foregroundStyle(Theme.TextColor.primary)
                    Text(subtitle)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.TextColor.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.TextColor.muted)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .neuRaised()
        }
        .buttonStyle(.plain)
    }
}

import SwiftUI

struct RootView: View {
    @State private var tab: String = "home"

    private let items: [BottomNavItem] = [
        BottomNavItem(id: "home",   label: "Home",   systemImage: "house.fill"),
        BottomNavItem(id: "music",  label: "Music",  systemImage: "music.note"),
        BottomNavItem(id: "bridge", label: "Bridge", systemImage: "server.rack"),
        BottomNavItem(id: "settings", label: "Settings", systemImage: "gearshape")
    ]

    var body: some View {
        ZStack {
            Theme.Surface.bg.ignoresSafeArea()

            VStack(spacing: 0) {
                Group {
                    switch tab {
                    case "music":    MusicView()
                    case "bridge":   HomebridgeView()
                    case "settings": SettingsView()
                    default:         HomeView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                BottomNav(items: items, selection: $tab)
            }
        }
    }
}

import SwiftUI

@main
struct CasaControlApp: App {
    @StateObject private var store = HomeStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(SpotifyClient.shared)
                .environmentObject(HomebridgeClient.shared)
        }
    }
}

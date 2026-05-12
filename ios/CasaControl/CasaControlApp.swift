import SwiftUI

@main
struct CasaControlApp: App {
    @StateObject private var store = HomeStore()

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environmentObject(store)
        }
    }
}

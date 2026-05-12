import SwiftUI
import HomeKit

struct HomeView: View {
    @EnvironmentObject private var store: HomeStore

    var body: some View {
        NavigationStack {
            Group {
                if let home = store.primaryHome {
                    List {
                        ForEach(home.rooms, id: \.uniqueIdentifier) { room in
                            let roomAccessories = store.accessories.filter { $0.room?.uniqueIdentifier == room.uniqueIdentifier }
                            if !roomAccessories.isEmpty {
                                Section(room.name) {
                                    ForEach(roomAccessories, id: \.uniqueIdentifier) { accessory in
                                        AccessoryRow(accessory: accessory)
                                    }
                                }
                            }
                        }
                        let unassigned = store.accessories.filter { $0.room == nil }
                        if !unassigned.isEmpty {
                            Section("Unassigned") {
                                ForEach(unassigned, id: \.uniqueIdentifier) { accessory in
                                    AccessoryRow(accessory: accessory)
                                }
                            }
                        }
                    }
                    .navigationTitle(home.name)
                } else {
                    ContentUnavailableView("No Home Found", systemImage: "house", description: Text("Make sure this device is signed into the same iCloud account as your HomeKit home."))
                }
            }
        }
    }
}

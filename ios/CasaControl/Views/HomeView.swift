import SwiftUI
import HomeKit

struct HomeView: View {
    @EnvironmentObject private var store: HomeStore

    var body: some View {
        ZStack {
            Theme.Surface.bg.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.s5) {
                    header
                    if let home = store.primaryHome {
                        rooms(for: home)
                    } else {
                        empty
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, Theme.Space.s6)
            }
        }
        .preferredColorScheme(nil)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(greeting)
                    .font(Theme.Typography.h1)
                    .foregroundStyle(Theme.TextColor.primary)
                Text(store.primaryHome?.name ?? "Casa Control")
                    .font(Theme.Typography.sub)
                    .foregroundStyle(Theme.TextColor.secondary)
            }
            Spacer()
        }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12:  return "Good morning"
        case 12..<17: return "Good afternoon"
        case 17..<22: return "Good evening"
        default:      return "Hello"
        }
    }

    @ViewBuilder
    private func rooms(for home: HMHome) -> some View {
        ForEach(home.rooms, id: \.uniqueIdentifier) { room in
            let roomAccessories = store.accessories.filter {
                $0.room?.uniqueIdentifier == room.uniqueIdentifier
            }
            if !roomAccessories.isEmpty {
                VStack(alignment: .leading, spacing: Theme.Space.s3) {
                    SectionLabel(text: room.name)
                    VStack(spacing: Theme.Space.s3) {
                        ForEach(roomAccessories, id: \.uniqueIdentifier) { accessory in
                            AccessoryRow(accessory: accessory)
                        }
                    }
                }
            }
        }
        let unassigned = store.accessories.filter { $0.room == nil }
        if !unassigned.isEmpty {
            VStack(alignment: .leading, spacing: Theme.Space.s3) {
                SectionLabel(text: "Unassigned")
                VStack(spacing: Theme.Space.s3) {
                    ForEach(unassigned, id: \.uniqueIdentifier) { accessory in
                        AccessoryRow(accessory: accessory)
                    }
                }
            }
        }
    }

    private var empty: some View {
        VStack(spacing: Theme.Space.s3) {
            IconWell(systemName: "house", size: .lg)
            Text("No Home Found")
                .font(Theme.Typography.h2)
                .foregroundStyle(Theme.TextColor.primary)
            Text("Make sure this device is signed into the same iCloud account as your HomeKit home.")
                .font(Theme.Typography.sub)
                .foregroundStyle(Theme.TextColor.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(Theme.Space.s6)
        .neuRaised()
    }
}

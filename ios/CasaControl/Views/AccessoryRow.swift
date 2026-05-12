import SwiftUI
import HomeKit

struct AccessoryRow: View {
    let accessory: HMAccessory
    @EnvironmentObject private var store: HomeStore

    private var power: HMCharacteristic? {
        accessory.firstCharacteristic(type: HMCharacteristicTypePowerState)
    }

    private var brightness: HMCharacteristic? {
        accessory.firstCharacteristic(type: HMCharacteristicTypeBrightness)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(accessory.name)
                Spacer()
                if let power {
                    Toggle("", isOn: Binding(
                        get: { (power.value as? Bool) ?? false },
                        set: { _ in store.toggle(accessory) }
                    ))
                    .labelsHidden()
                }
            }
            if let brightness {
                Slider(
                    value: Binding(
                        get: { Double((brightness.value as? Int) ?? 0) },
                        set: { store.setBrightness(accessory, Int($0)) }
                    ),
                    in: 0...100
                )
            }
        }
        .padding(.vertical, 4)
    }
}

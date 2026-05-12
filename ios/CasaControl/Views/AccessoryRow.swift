import SwiftUI
import HomeKit

/// Light-card pattern from CSS: icon well + name/status + toggle, expandable
/// brightness slider when a brightness characteristic is present.
struct AccessoryRow: View {
    let accessory: HMAccessory
    @EnvironmentObject private var store: HomeStore
    @State private var expanded = false

    private var power: HMCharacteristic? {
        accessory.firstCharacteristic(type: HMCharacteristicTypePowerState)
    }
    private var brightness: HMCharacteristic? {
        accessory.firstCharacteristic(type: HMCharacteristicTypeBrightness)
    }

    private var isOn: Bool { (power?.value as? Bool) ?? false }

    var body: some View {
        VStack(spacing: Theme.Space.s4) {
            top
            if expanded, brightness != nil {
                slider
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
        .neuRaised()
    }

    private var top: some View {
        HStack(spacing: Theme.Space.s4) {
            IconWell(systemName: icon, on: isOn)

            VStack(alignment: .leading, spacing: 2) {
                Text(accessory.name)
                    .font(Theme.Typography.sans(14, weight: .semibold))
                    .foregroundStyle(Theme.TextColor.primary)
                Text(statusText)
                    .font(Theme.Typography.sans(11))
                    .foregroundStyle(Theme.TextColor.secondary)
            }
            Spacer(minLength: 0)

            if brightness != nil {
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                        expanded.toggle()
                    }
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.TextColor.muted)
                        .rotationEffect(.degrees(expanded ? 180 : 0))
                }
                .buttonStyle(.plain)
            }

            if power != nil {
                Toggle("", isOn: Binding(
                    get: { isOn },
                    set: { _ in store.toggle(accessory) }
                ))
                .labelsHidden()
                .toggleStyle(NeuToggleStyle())
            }
        }
    }

    private var slider: some View {
        NeuSlider(
            value: Binding(
                get: { Double((brightness?.value as? Int) ?? 0) },
                set: { store.setBrightness(accessory, Int($0)) }
            ),
            range: 0...100,
            variant: .brightness,
            label: "Bri",
            valueFormatter: { "\(Int($0))%" }
        )
    }

    private var icon: String {
        if brightness != nil { return "lightbulb" }
        if accessory.services.contains(where: { $0.serviceType == HMServiceTypeOutlet }) { return "powerplug" }
        if accessory.services.contains(where: { $0.serviceType == HMServiceTypeSwitch }) { return "switch.2" }
        if accessory.services.contains(where: { $0.serviceType == HMServiceTypeThermostat }) { return "thermometer" }
        if accessory.services.contains(where: { $0.serviceType == HMServiceTypeFan }) { return "fan" }
        return "circle.dotted"
    }

    private var statusText: String {
        if power != nil {
            if let bri = brightness?.value as? Int, isOn {
                return "On · \(bri)%"
            }
            return isOn ? "On" : "Off"
        }
        return accessory.room?.name ?? ""
    }
}

import Foundation
import HomeKit
import Combine

@MainActor
final class HomeStore: NSObject, ObservableObject {
    @Published private(set) var primaryHome: HMHome?
    @Published private(set) var accessories: [HMAccessory] = []
    @Published private(set) var authorizationStatus: HMHomeManagerAuthorizationStatus = []

    private let manager = HMHomeManager()

    override init() {
        super.init()
        manager.delegate = self
    }

    func toggle(_ accessory: HMAccessory) {
        guard let power = accessory.firstCharacteristic(type: HMCharacteristicTypePowerState) else { return }
        let current = (power.value as? Bool) ?? false
        power.writeValue(!current) { error in
            if let error { print("toggle failed: \(error)") }
        }
    }

    func setBrightness(_ accessory: HMAccessory, _ value: Int) {
        guard let brightness = accessory.firstCharacteristic(type: HMCharacteristicTypeBrightness) else { return }
        brightness.writeValue(value) { error in
            if let error { print("brightness failed: \(error)") }
        }
    }

    private func refresh() {
        primaryHome = manager.primaryHome ?? manager.homes.first
        accessories = primaryHome?.accessories ?? []
        for accessory in accessories {
            accessory.delegate = self
            for service in accessory.services {
                for characteristic in service.characteristics where characteristic.properties.contains(HMCharacteristicPropertySupportsEventNotification) {
                    characteristic.enableNotification(true) { _ in }
                }
            }
        }
    }
}

extension HomeStore: HMHomeManagerDelegate {
    nonisolated func homeManagerDidUpdateHomes(_ manager: HMHomeManager) {
        Task { @MainActor in self.refresh() }
    }

    nonisolated func homeManager(_ manager: HMHomeManager, didUpdateAuthorizationStatus status: HMHomeManagerAuthorizationStatus) {
        Task { @MainActor in self.authorizationStatus = status }
    }
}

extension HomeStore: HMAccessoryDelegate {
    nonisolated func accessory(_ accessory: HMAccessory, service: HMService, didUpdateValueFor characteristic: HMCharacteristic) {
        Task { @MainActor in self.objectWillChange.send() }
    }
}

extension HMAccessory {
    func firstCharacteristic(type: String) -> HMCharacteristic? {
        for service in services {
            if let match = service.characteristics.first(where: { $0.characteristicType == type }) {
                return match
            }
        }
        return nil
    }
}

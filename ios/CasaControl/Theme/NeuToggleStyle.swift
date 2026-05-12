import SwiftUI

/// 48x26 toggle. Off-track #c4c7d4, white knob.
/// On-track = accent ember with glow halo. Mirrors CSS `.toggle`.
struct NeuToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: Theme.Space.s3) {
            configuration.label
            Spacer(minLength: 0)
            track(isOn: configuration.isOn)
                .onTapGesture {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        configuration.isOn.toggle()
                    }
                }
        }
    }

    private func track(isOn: Bool) -> some View {
        ZStack(alignment: isOn ? .trailing : .leading) {
            Capsule()
                .fill(isOn ? AnyShapeStyle(Theme.Accent.ember) : AnyShapeStyle(offTrack))
                .frame(width: 48, height: 26)
                .shadow(color: isOn ? Theme.Accent.glow : .clear, radius: 12)

            Circle()
                .fill(Color.white)
                .frame(width: 20, height: 20)
                .shadow(color: .black.opacity(0.25), radius: 2, x: 1, y: 1)
                .padding(.horizontal, 3)
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isOn)
    }

    private var offTrack: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 0x3A/255, green: 0x3D/255, blue: 0x4A/255, alpha: 1)
                : UIColor(red: 0xC4/255, green: 0xC7/255, blue: 0xD4/255, alpha: 1)
        })
    }
}

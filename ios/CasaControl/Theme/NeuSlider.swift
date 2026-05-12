import SwiftUI

/// Slider variant. `.brightness` uses the ember→amber gradient; `.temp` uses the
/// warm→cool color-temp gradient with no glow.
enum NeuSliderVariant {
    case accent
    case brightness
    case temp
}

/// Custom slider per the Smartmorphic spec — there's no SliderStyle protocol,
/// so this is a from-scratch control. Drag the track or the knob.
struct NeuSlider: View {
    @Binding var value: Double
    var range: ClosedRange<Double> = 0...100
    var variant: NeuSliderVariant = .accent
    var label: String? = nil
    var showValue: Bool = true
    var valueFormatter: (Double) -> String = { "\(Int($0))" }

    var body: some View {
        HStack(spacing: Theme.Space.s3) {
            if let label {
                Text(label.uppercased())
                    .font(Theme.Typography.sans(10, weight: .semibold))
                    .tracking(0.8)
                    .foregroundStyle(Theme.TextColor.muted)
                    .frame(width: 36, alignment: .leading)
            }

            GeometryReader { geo in
                let progress = CGFloat((value - range.lowerBound) / (range.upperBound - range.lowerBound))
                let clamped = max(0, min(1, progress))

                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Theme.Surface.surface)
                        .frame(height: 8)
                        .neuPressedSm(radius: 4)

                    fill
                        .frame(width: geo.size.width * clamped, height: 8)
                        .clipShape(Capsule())
                        .shadow(color: variant == .temp ? .clear : Theme.Accent.glow, radius: 6)

                    Circle()
                        .fill(Theme.Surface.surface)
                        .frame(width: 20, height: 20)
                        .neuRaisedSm(radius: 10)
                        .offset(x: max(0, geo.size.width * clamped - 10))
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { gesture in
                            let ratio = max(0, min(1, gesture.location.x / geo.size.width))
                            value = range.lowerBound + Double(ratio) * (range.upperBound - range.lowerBound)
                        }
                )
            }
            .frame(height: 20)

            if showValue {
                Text(valueFormatter(value))
                    .font(Theme.Typography.sans(12, weight: .semibold))
                    .foregroundStyle(Theme.TextColor.secondary)
                    .frame(width: 50, alignment: .trailing)
            }
        }
    }

    @ViewBuilder private var fill: some View {
        switch variant {
        case .accent:
            Rectangle().fill(Theme.Accent.ember)
        case .brightness:
            Rectangle().fill(
                LinearGradient(
                    colors: [Theme.Accent.ember, Color(red: 0xF0/255, green: 0xA0/255, blue: 0x50/255)],
                    startPoint: .leading, endPoint: .trailing
                )
            )
        case .temp:
            Rectangle().fill(
                LinearGradient(
                    colors: [
                        Color(red: 0xFF/255, green: 0xAA/255, blue: 0x5A/255),
                        Color(red: 0xFF/255, green: 0xD9/255, blue: 0xA8/255),
                        Color(red: 0xFF/255, green: 0xF5/255, blue: 0xE6/255),
                        Color(red: 0xE8/255, green: 0xF0/255, blue: 0xF8/255),
                        Color(red: 0xB0/255, green: 0xD4/255, blue: 0xF1/255)
                    ],
                    startPoint: .leading, endPoint: .trailing
                )
            )
        }
    }
}

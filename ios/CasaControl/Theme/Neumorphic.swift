import SwiftUI

/// Three depth levels per the Smartmorphic spec.
/// Each "raised" level pairs a light shadow (top-left) with a dark shadow (bottom-right).
/// Each "pressed" level is an inset effect emulated with stacked inner shadows.
enum NeuDepth {
    case raisedSm
    case raised
    case raisedLg
    case pressedSm
    case pressed
}

struct NeuSurface: ViewModifier {
    let depth: NeuDepth
    var radius: CGFloat = Theme.Radius.base

    func body(content: Content) -> some View {
        switch depth {
        case .raisedSm:
            content
                .background(
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .fill(Theme.Surface.surface)
                        .shadow(color: Theme.Shadow.dark, radius: 5, x: 4, y: 4)
                        .shadow(color: Theme.Shadow.light, radius: 5, x: -4, y: -4)
                )
        case .raised:
            content
                .background(
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .fill(Theme.Surface.surface)
                        .shadow(color: Theme.Shadow.dark, radius: 7, x: 6, y: 6)
                        .shadow(color: Theme.Shadow.light, radius: 7, x: -6, y: -6)
                )
        case .raisedLg:
            content
                .background(
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .fill(Theme.Surface.surface)
                        .shadow(color: Theme.Shadow.dark, radius: 12, x: 10, y: 10)
                        .shadow(color: Theme.Shadow.light, radius: 12, x: -10, y: -10)
                )
        case .pressedSm:
            content
                .background(
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .fill(Theme.Surface.surface)
                        .overlay(InnerShadow(radius: radius, blur: 4, offset: 2))
                )
        case .pressed:
            content
                .background(
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .fill(Theme.Surface.surface)
                        .overlay(InnerShadow(radius: radius, blur: 6, offset: 3))
                )
        }
    }
}

/// Two-direction inner shadow approximating CSS `inset` neumorphism.
private struct InnerShadow: View {
    let radius: CGFloat
    let blur: CGFloat
    let offset: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .stroke(Color.clear, lineWidth: 0)
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(Theme.Shadow.insetDark, lineWidth: blur)
                    .blur(radius: blur)
                    .offset(x: offset, y: offset)
                    .mask(RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .fill(LinearGradient(colors: [.black, .clear], startPoint: .topLeading, endPoint: .bottomTrailing)))
            )
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(Theme.Shadow.insetLight, lineWidth: blur)
                    .blur(radius: blur)
                    .offset(x: -offset, y: -offset)
                    .mask(RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .fill(LinearGradient(colors: [.black, .clear], startPoint: .bottomTrailing, endPoint: .topLeading)))
            )
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .allowsHitTesting(false)
    }
}

extension View {
    func neuRaised(radius: CGFloat = Theme.Radius.base) -> some View {
        modifier(NeuSurface(depth: .raised, radius: radius))
    }
    func neuRaisedSm(radius: CGFloat = Theme.Radius.sm) -> some View {
        modifier(NeuSurface(depth: .raisedSm, radius: radius))
    }
    func neuRaisedLg(radius: CGFloat = Theme.Radius.lg) -> some View {
        modifier(NeuSurface(depth: .raisedLg, radius: radius))
    }
    func neuPressed(radius: CGFloat = Theme.Radius.base) -> some View {
        modifier(NeuSurface(depth: .pressed, radius: radius))
    }
    func neuPressedSm(radius: CGFloat = Theme.Radius.sm) -> some View {
        modifier(NeuSurface(depth: .pressedSm, radius: radius))
    }
}

/// Pressed-inset square that hosts an SF Symbol. Mirrors `.icon-well` in CSS.
struct IconWell: View {
    enum Size { case sm, base, lg }
    let systemName: String
    var size: Size = .base
    var on: Bool = false

    var body: some View {
        let metrics = sizeMetrics
        ZStack {
            RoundedRectangle(cornerRadius: metrics.radius, style: .continuous)
                .fill(Theme.Surface.surface)
            Image(systemName: systemName)
                .font(.system(size: metrics.icon, weight: .medium))
                .foregroundStyle(on ? Theme.Accent.ember : Theme.TextColor.muted)
        }
        .frame(width: metrics.dim, height: metrics.dim)
        .neuPressedSm(radius: metrics.radius)
        .shadow(color: on ? Theme.Accent.glow : .clear, radius: 12)
    }

    private var sizeMetrics: (dim: CGFloat, icon: CGFloat, radius: CGFloat) {
        switch size {
        case .sm:   return (28, 14, 8)
        case .base: return (38, 18, Theme.Radius.sm)
        case .lg:   return (52, 24, 16)
        }
    }
}

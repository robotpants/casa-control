import SwiftUI

/// Display-font uppercase eyebrow used inside views. Mirrors `.section-label` / `.eyebrow`.
struct SectionLabel: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(Theme.Typography.display(11, weight: .semibold))
            .tracking(1.5)
            .foregroundStyle(Theme.TextColor.muted)
    }
}

/// Pill chip used for scenes. Active = pressed-inset + accent text; never fills.
struct SceneChip: View {
    let title: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Space.s2) {
                Circle()
                    .fill(isActive ? Theme.Accent.ember : Theme.TextColor.muted)
                    .frame(width: 6, height: 6)
                    .shadow(color: isActive ? Theme.Accent.glow : .clear, radius: 6)
                Text(title)
                    .font(Theme.Typography.sans(13, weight: .semibold))
                    .foregroundStyle(isActive ? Theme.Accent.ember : Theme.TextColor.secondary)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .modifier(SceneChipBackground(isActive: isActive))
        }
        .buttonStyle(.plain)
    }
}

private struct SceneChipBackground: ViewModifier {
    let isActive: Bool
    func body(content: Content) -> some View {
        if isActive {
            content.neuPressedSm(radius: 30)
        } else {
            content.neuRaisedSm(radius: 30)
        }
    }
}

/// Semantic status pill — 18% bg + darkened semantic text.
enum StatusKind { case ok, warning, alert, info }

struct StatusPill: View {
    let text: String
    let kind: StatusKind

    var body: some View {
        Text(text.uppercased())
            .font(Theme.Typography.sans(10, weight: .bold))
            .tracking(0.6)
            .foregroundStyle(foreground)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(background, in: Capsule())
    }

    private var background: Color {
        switch kind {
        case .ok:      return Theme.Semantic.success.opacity(0.18)
        case .warning: return Theme.Semantic.warning.opacity(0.22)
        case .alert:   return Theme.Semantic.danger.opacity(0.18)
        case .info:    return Color(red: 0x3A/255, green: 0x8E/255, blue: 0xE8/255).opacity(0.18)
        }
    }

    private var foreground: Color {
        switch kind {
        case .ok:      return Theme.Semantic.success
        case .warning: return Color(red: 0x8A/255, green: 0x6C/255, blue: 0x1F/255)
        case .alert:   return Theme.Semantic.danger
        case .info:    return Color(red: 0x1F/255, green: 0x5B/255, blue: 0x96/255)
        }
    }
}

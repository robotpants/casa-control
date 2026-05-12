import SwiftUI

struct BottomNavItem: Identifiable, Equatable {
    let id: String
    let label: String
    let systemImage: String
}

struct BottomNav: View {
    let items: [BottomNavItem]
    @Binding var selection: String

    var body: some View {
        HStack {
            ForEach(items) { item in
                Button {
                    withAnimation(.easeOut(duration: 0.15)) { selection = item.id }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: item.systemImage)
                            .font(.system(size: 20, weight: .medium))
                        Text(item.label.uppercased())
                            .font(Theme.Typography.sans(10, weight: .semibold))
                            .tracking(0.5)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .foregroundStyle(selection == item.id ? Theme.Accent.ember : Theme.TextColor.muted)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 4)
        .frame(height: Theme.Layout.navHeight)
        .background(
            Theme.Surface.surface
                .shadow(color: Theme.Shadow.dark, radius: 12, x: 0, y: -4)
                .ignoresSafeArea(edges: .bottom)
        )
    }
}

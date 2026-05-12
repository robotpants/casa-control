import SwiftUI

struct HomebridgeView: View {
    @EnvironmentObject private var hb: HomebridgeClient
    @State private var showingLogin = false

    var body: some View {
        ZStack {
            Theme.Surface.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.s5) {
                    header
                    if !hb.isConfigured {
                        configurePrompt
                    } else if !hb.isAuthenticated {
                        loginPrompt
                    } else {
                        statusCard
                        childBridgesSection
                        pluginsSection
                        logsSection
                    }
                    if let error = hb.lastError {
                        Text(error)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Semantic.danger)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, Theme.Space.s6)
            }
        }
        .sheet(isPresented: $showingLogin) {
            HomebridgeLoginSheet()
                .presentationDetents([.medium])
        }
        .task {
            if hb.isAuthenticated {
                await hb.refreshAll()
                hb.startPolling()
            }
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Homebridge")
                    .font(Theme.Typography.h1)
                    .foregroundStyle(Theme.TextColor.primary)
                Text(hb.isConfigured ? "\(hb.host):\(hb.port)" : "Not configured")
                    .font(Theme.Typography.sub)
                    .foregroundStyle(Theme.TextColor.secondary)
            }
            Spacer()
            if hb.isAuthenticated {
                Button {
                    Task { await hb.restartServer() }
                } label: {
                    IconWell(systemName: "arrow.clockwise", on: false)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var configurePrompt: some View {
        VStack(alignment: .leading, spacing: Theme.Space.s4) {
            Text("Set Homebridge connection")
                .font(Theme.Typography.h3)
                .foregroundStyle(Theme.TextColor.primary)
            Text("Add the host (Pi LAN IP or hostname) and port for the homebridge-config-ui-x admin UI. Default port is 8581.")
                .font(Theme.Typography.sub)
                .foregroundStyle(Theme.TextColor.secondary)
            Button {
                showingLogin = true
            } label: {
                Text("Configure")
                    .font(Theme.Typography.sans(14, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(.white)
                    .background(Theme.Accent.ember, in: RoundedRectangle(cornerRadius: Theme.Radius.sm))
                    .shadow(color: Theme.Accent.glow, radius: 12, y: 4)
            }
            .buttonStyle(.plain)
        }
        .padding(20)
        .neuRaised()
    }

    private var loginPrompt: some View {
        VStack(alignment: .leading, spacing: Theme.Space.s4) {
            Text("Sign in")
                .font(Theme.Typography.h3)
                .foregroundStyle(Theme.TextColor.primary)
            Text("Use your Homebridge UI admin credentials.")
                .font(Theme.Typography.sub)
                .foregroundStyle(Theme.TextColor.secondary)
            Button {
                showingLogin = true
            } label: {
                Text("Sign in")
                    .font(Theme.Typography.sans(14, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(.white)
                    .background(Theme.Accent.ember, in: RoundedRectangle(cornerRadius: Theme.Radius.sm))
            }
            .buttonStyle(.plain)
        }
        .padding(20)
        .neuRaised()
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: Theme.Space.s4) {
            HStack {
                Text("Server")
                    .font(Theme.Typography.h3)
                    .foregroundStyle(Theme.TextColor.primary)
                Spacer()
                StatusPill(text: hb.status?.status ?? "?", kind: (hb.status?.status == "up") ? .ok : .warning)
            }
            HStack(spacing: Theme.Space.s3) {
                statTile(label: "CPU", value: hb.status?.cpuLoad.map { String(format: "%.0f%%", $0) } ?? "—")
                statTile(label: "RAM", value: hb.status?.memoryUsed.map { String(format: "%.0fM", $0) } ?? "—")
                statTile(label: "Uptime", value: hb.status?.uptimeSeconds.map(formatUptime) ?? "—")
            }
            if let v = hb.status?.homebridgeVersion {
                Text("Homebridge v\(v)")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.TextColor.muted)
            }
        }
        .padding(18)
        .neuRaised()
    }

    private func statTile(label: String, value: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(Theme.Typography.stat)
                .foregroundStyle(Theme.TextColor.primary)
            Text(label.uppercased())
                .font(Theme.Typography.sans(10, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(Theme.TextColor.muted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .neuPressedSm(radius: 12)
    }

    private var childBridgesSection: some View {
        VStack(alignment: .leading, spacing: Theme.Space.s3) {
            SectionLabel(text: "Child Bridges")
            if hb.childBridges.isEmpty {
                Text("No child bridges").font(Theme.Typography.sub).foregroundStyle(Theme.TextColor.muted)
            } else {
                VStack(spacing: Theme.Space.s2) {
                    ForEach(hb.childBridges) { bridge in
                        bridgeRow(bridge)
                    }
                }
            }
        }
    }

    private func bridgeRow(_ bridge: HomebridgeClient.ChildBridge) -> some View {
        HStack(spacing: Theme.Space.s3) {
            IconWell(systemName: "shippingbox", on: bridge.status == "ok")
            VStack(alignment: .leading, spacing: 2) {
                Text(bridge.name)
                    .font(Theme.Typography.sans(14, weight: .semibold))
                    .foregroundStyle(Theme.TextColor.primary)
                Text(bridge.plugin)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.TextColor.muted)
            }
            Spacer()
            StatusPill(text: bridge.status, kind: bridge.status == "ok" ? .ok : .alert)
            Button {
                Task { await hb.restartChildBridge(bridge) }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.TextColor.muted)
                    .padding(8)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .neuRaised()
    }

    private var pluginsSection: some View {
        VStack(alignment: .leading, spacing: Theme.Space.s3) {
            HStack {
                SectionLabel(text: "Plugins")
                Spacer()
                Text("\(hb.plugins.count)").font(Theme.Typography.caption).foregroundStyle(Theme.TextColor.muted)
            }
            VStack(spacing: Theme.Space.s2) {
                ForEach(hb.plugins.prefix(20)) { plugin in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(plugin.displayName)
                                .font(Theme.Typography.sans(13, weight: .semibold))
                                .foregroundStyle(Theme.TextColor.primary)
                            Text("v\(plugin.installedVersion)")
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.TextColor.muted)
                        }
                        Spacer()
                        if plugin.updateAvailable {
                            StatusPill(text: "Update", kind: .warning)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .neuRaised()
                }
            }
        }
    }

    private var logsSection: some View {
        VStack(alignment: .leading, spacing: Theme.Space.s3) {
            HStack {
                SectionLabel(text: "Recent Logs")
                Spacer()
                Button {
                    Task { await hb.refreshLogs() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.TextColor.muted)
                }
                .buttonStyle(.plain)
            }
            ScrollView(.vertical, showsIndicators: false) {
                Text(hb.logTail.isEmpty ? "No logs yet." : hb.logTail)
                    .font(Theme.Typography.mono(11))
                    .foregroundStyle(Theme.TextColor.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
            }
            .frame(maxHeight: 240)
            .neuPressed()
        }
    }

    private func formatUptime(_ seconds: Int) -> String {
        let d = seconds / 86400
        let h = (seconds % 86400) / 3600
        if d > 0 { return "\(d)d \(h)h" }
        let m = (seconds % 3600) / 60
        return "\(h)h \(m)m"
    }
}

struct HomebridgeLoginSheet: View {
    @EnvironmentObject private var hb: HomebridgeClient
    @Environment(\.dismiss) private var dismiss
    @State private var username: String = ""
    @State private var password: String = ""

    var body: some View {
        ZStack {
            Theme.Surface.bg.ignoresSafeArea()
            VStack(alignment: .leading, spacing: Theme.Space.s4) {
                Text("Connect to Homebridge")
                    .font(Theme.Typography.h2)
                    .foregroundStyle(Theme.TextColor.primary)

                field(label: "Host", text: $hb.host, placeholder: "192.168.1.100")
                HStack(spacing: Theme.Space.s3) {
                    field(label: "Port", value: $hb.port)
                        .frame(width: 100)
                    Toggle("TLS", isOn: $hb.useTLS)
                        .toggleStyle(NeuToggleStyle())
                        .font(Theme.Typography.sub)
                        .foregroundStyle(Theme.TextColor.secondary)
                }
                field(label: "Username", text: $username, placeholder: "admin")
                secureField(label: "Password", text: $password)

                Button {
                    Task {
                        await hb.login(username: username, password: password)
                        if hb.isAuthenticated { dismiss() }
                    }
                } label: {
                    Text("Sign in")
                        .font(Theme.Typography.sans(14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .foregroundStyle(.white)
                        .background(Theme.Accent.ember, in: RoundedRectangle(cornerRadius: Theme.Radius.sm))
                }
                .buttonStyle(.plain)
                .padding(.top, 4)

                Spacer()
            }
            .padding(20)
        }
    }

    private func field(label: String, text: Binding<String>, placeholder: String = "") -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(Theme.Typography.sans(10, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(Theme.TextColor.muted)
            TextField(placeholder, text: text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .neuPressedSm()
        }
    }

    private func field(label: String, value: Binding<Int>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(Theme.Typography.sans(10, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(Theme.TextColor.muted)
            TextField("", value: value, format: .number)
                .keyboardType(.numberPad)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .neuPressedSm()
        }
    }

    private func secureField(label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(Theme.Typography.sans(10, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(Theme.TextColor.muted)
            SecureField("", text: text)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .neuPressedSm()
        }
    }
}

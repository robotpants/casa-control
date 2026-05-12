import Foundation
import SwiftUI

/// REST client for homebridge-config-ui-x (the universal Homebridge admin UI plugin).
/// Default port 8581. Auth flow: POST /api/auth/login → JWT, attach as Bearer.
///
/// Connection settings persist in UserDefaults; credentials in Keychain.
@MainActor
final class HomebridgeClient: ObservableObject {
    static let shared = HomebridgeClient()

    struct ServerStatus: Equatable {
        let status: String
        let cpuLoad: Double?
        let memoryUsed: Double?
        let uptimeSeconds: Int?
        let homebridgeVersion: String?
    }

    struct ChildBridge: Identifiable, Equatable {
        let id: String          // username
        let name: String
        let plugin: String
        let status: String      // ok | pending | down
        let pid: Int?
    }

    struct PluginInfo: Identifiable, Equatable {
        let id: String          // name
        let displayName: String
        let installedVersion: String
        let latestVersion: String?
        let updateAvailable: Bool
    }

    @Published var host: String {
        didSet { UserDefaults.standard.set(host, forKey: "homebridge.host") }
    }
    @Published var port: Int {
        didSet { UserDefaults.standard.set(port, forKey: "homebridge.port") }
    }
    @Published var useTLS: Bool {
        didSet { UserDefaults.standard.set(useTLS, forKey: "homebridge.useTLS") }
    }

    @Published private(set) var isAuthenticated: Bool = false
    @Published private(set) var status: ServerStatus?
    @Published private(set) var childBridges: [ChildBridge] = []
    @Published private(set) var plugins: [PluginInfo] = []
    @Published private(set) var logTail: String = ""
    @Published private(set) var lastError: String?

    private var token: String? {
        didSet { isAuthenticated = token != nil }
    }
    private let session = URLSession.shared
    private var pollTask: Task<Void, Never>?

    init() {
        let defaults = UserDefaults.standard
        self.host = defaults.string(forKey: "homebridge.host") ?? ""
        let storedPort = defaults.integer(forKey: "homebridge.port")
        self.port = storedPort == 0 ? 8581 : storedPort
        self.useTLS = defaults.bool(forKey: "homebridge.useTLS")
        self.token = Keychain.get("homebridge.token")
        self.isAuthenticated = token != nil
    }

    var isConfigured: Bool { !host.isEmpty }

    private var baseURL: URL? {
        guard !host.isEmpty else { return nil }
        return URL(string: "\(useTLS ? "https" : "http")://\(host):\(port)")
    }

    // MARK: - Auth

    func login(username: String, password: String) async {
        guard let base = baseURL else { lastError = "Set host first"; return }
        var req = URLRequest(url: base.appendingPathComponent("/api/auth/login"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: [
            "username": username, "password": password, "otp": ""
        ])
        do {
            let (data, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                lastError = "Login failed (\((response as? HTTPURLResponse)?.statusCode ?? -1))"
                return
            }
            struct LoginResp: Decodable { let access_token: String }
            let resp = try JSONDecoder().decode(LoginResp.self, from: data)
            self.token = resp.access_token
            Keychain.set(resp.access_token, for: "homebridge.token")
            await refreshAll()
            startPolling()
        } catch {
            lastError = "Login error: \(error.localizedDescription)"
        }
    }

    func signOut() {
        token = nil
        Keychain.set(nil, for: "homebridge.token")
        status = nil
        childBridges = []
        plugins = []
        pollTask?.cancel()
    }

    // MARK: - Reads

    func refreshAll() async {
        await refreshStatus()
        await refreshChildBridges()
        await refreshPlugins()
        await refreshLogs()
    }

    func refreshStatus() async {
        if let data = try? await get("/api/status/homebridge"),
           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            let s = obj["status"] as? String ?? "unknown"
            var cpu: Double?
            var mem: Double?
            var up: Int?
            if let data2 = try? await get("/api/status/cpu"),
               let cpuObj = try? JSONSerialization.jsonObject(with: data2) as? [String: Any] {
                cpu = cpuObj["currentLoad"] as? Double
            }
            if let data3 = try? await get("/api/status/ram"),
               let ramObj = try? JSONSerialization.jsonObject(with: data3) as? [String: Any] {
                mem = ramObj["used"] as? Double
            }
            if let data4 = try? await get("/api/status/uptime"),
               let upObj = try? JSONSerialization.jsonObject(with: data4) as? [String: Any] {
                up = upObj["time"] as? Int
            }
            var version: String?
            if let data5 = try? await get("/api/status/homebridge-version"),
               let vObj = try? JSONSerialization.jsonObject(with: data5) as? [String: Any] {
                version = vObj["homebridgeVersion"] as? String
            }
            self.status = ServerStatus(status: s, cpuLoad: cpu, memoryUsed: mem,
                                       uptimeSeconds: up, homebridgeVersion: version)
        }
    }

    func refreshChildBridges() async {
        guard let data = try? await get("/api/status/homebridge/child-bridges"),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return }
        self.childBridges = arr.map { dict in
            ChildBridge(
                id: dict["username"] as? String ?? UUID().uuidString,
                name: dict["name"] as? String ?? "Unnamed",
                plugin: dict["plugin"] as? String ?? "",
                status: dict["status"] as? String ?? "unknown",
                pid: dict["pid"] as? Int
            )
        }
    }

    func refreshPlugins() async {
        guard let data = try? await get("/api/plugins"),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return }
        self.plugins = arr.map { dict in
            PluginInfo(
                id: dict["name"] as? String ?? UUID().uuidString,
                displayName: dict["displayName"] as? String ?? (dict["name"] as? String ?? ""),
                installedVersion: dict["installedVersion"] as? String ?? "",
                latestVersion: dict["latestVersion"] as? String,
                updateAvailable: dict["updateAvailable"] as? Bool ?? false
            )
        }
    }

    func refreshLogs() async {
        // Tail a small amount — config-ui-x exposes /api/platform-tools/hb-service/log/download
        // for full logs; for inline tail we hit /api/platform-tools/hb-service/log/tail.
        if let data = try? await get("/api/platform-tools/hb-service/log/tail?lines=50") {
            self.logTail = String(data: data, encoding: .utf8) ?? ""
        }
    }

    // MARK: - Actions

    func restartServer() async {
        _ = try? await put("/api/server/restart")
        await refreshStatus()
    }

    func restartChildBridge(_ bridge: ChildBridge) async {
        _ = try? await put("/api/server/restart/\(bridge.id)")
        await refreshChildBridges()
    }

    // MARK: - Polling

    func startPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refreshStatus()
                await self?.refreshChildBridges()
                try? await Task.sleep(nanoseconds: 10_000_000_000)
            }
        }
    }

    // MARK: - Internals

    private func get(_ path: String) async throws -> Data {
        try await request(path: path, method: "GET")
    }

    @discardableResult
    private func put(_ path: String) async throws -> Data {
        try await request(path: path, method: "PUT")
    }

    private func request(path: String, method: String) async throws -> Data {
        guard let base = baseURL, let token else {
            throw URLError(.userAuthenticationRequired)
        }
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse {
            if http.statusCode == 401 {
                self.token = nil
                Keychain.set(nil, for: "homebridge.token")
                throw URLError(.userAuthenticationRequired)
            }
            guard (200..<300).contains(http.statusCode) else {
                throw NSError(domain: "Homebridge", code: http.statusCode)
            }
        }
        return data
    }
}

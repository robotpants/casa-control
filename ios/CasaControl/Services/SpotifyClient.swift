import Foundation
import SwiftUI
import AuthenticationServices
import CryptoKit

/// Pure Web API + OAuth PKCE client. Avoids the proprietary SpotifyiOS SDK.
/// Playback control requires a Spotify Premium account with an active Connect
/// device on the network. Now-playing reads work without Premium.
///
/// Configure in `SpotifyConfig` below: clientID + redirect URI must match what
/// you register at https://developer.spotify.com/dashboard.
enum SpotifyConfig {
    /// Set from Spotify developer dashboard. Empty = unconfigured (UI shows setup state).
    static let clientID = ""
    /// Must be added as a redirect URI on the Spotify dashboard AND registered
    /// as a URL scheme in Info.plist (CFBundleURLTypes).
    static let redirectURI = "casacontrol://spotify-callback"
    /// Scopes for read + playback control.
    static let scopes = [
        "user-read-currently-playing",
        "user-read-playback-state",
        "user-modify-playback-state",
        "playlist-read-private",
        "user-library-read"
    ]
}

struct SpotifyTrack: Equatable {
    let id: String
    let title: String
    let artist: String
    let album: String
    let albumArtURL: URL?
    let durationMs: Int
    let progressMs: Int
    let isPlaying: Bool
}

@MainActor
final class SpotifyClient: NSObject, ObservableObject {
    static let shared = SpotifyClient()

    @Published private(set) var nowPlaying: SpotifyTrack?
    @Published private(set) var isAuthenticated: Bool = false
    @Published private(set) var lastError: String?

    private var accessToken: String? {
        didSet { isAuthenticated = accessToken != nil }
    }
    private var refreshToken: String?
    private var pkceVerifier: String?
    private var pollTask: Task<Void, Never>?

    private let session = URLSession.shared

    override init() {
        super.init()
        self.refreshToken = Keychain.get("spotify.refresh")
        self.accessToken = Keychain.get("spotify.access")
        self.isAuthenticated = accessToken != nil || refreshToken != nil
    }

    // MARK: - Auth (PKCE)

    func authenticate() async {
        guard !SpotifyConfig.clientID.isEmpty else {
            lastError = "Set SpotifyConfig.clientID in SpotifyClient.swift"
            return
        }
        let verifier = Self.randomString(length: 64)
        let challenge = Self.codeChallenge(for: verifier)
        pkceVerifier = verifier

        var components = URLComponents(string: "https://accounts.spotify.com/authorize")!
        components.queryItems = [
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "client_id", value: SpotifyConfig.clientID),
            URLQueryItem(name: "scope", value: SpotifyConfig.scopes.joined(separator: " ")),
            URLQueryItem(name: "redirect_uri", value: SpotifyConfig.redirectURI),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "code_challenge", value: challenge)
        ]

        guard let authURL = components.url,
              let scheme = URL(string: SpotifyConfig.redirectURI)?.scheme else { return }

        do {
            let callback = try await webAuth(url: authURL, callbackScheme: scheme)
            guard let code = URLComponents(url: callback, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "code" })?.value else {
                lastError = "Spotify auth: no code in callback"
                return
            }
            try await exchangeCode(code, verifier: verifier)
            await refreshNowPlaying()
            startPolling()
        } catch {
            lastError = "Spotify auth failed: \(error.localizedDescription)"
        }
    }

    func signOut() {
        accessToken = nil
        refreshToken = nil
        Keychain.set(nil, for: "spotify.access")
        Keychain.set(nil, for: "spotify.refresh")
        nowPlaying = nil
        pollTask?.cancel()
    }

    private func exchangeCode(_ code: String, verifier: String) async throws {
        let body = [
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": SpotifyConfig.redirectURI,
            "client_id": SpotifyConfig.clientID,
            "code_verifier": verifier
        ]
        try await tokenRequest(body: body)
    }

    private func refreshAccessToken() async throws {
        guard let refreshToken else { throw URLError(.userAuthenticationRequired) }
        let body = [
            "grant_type": "refresh_token",
            "refresh_token": refreshToken,
            "client_id": SpotifyConfig.clientID
        ]
        try await tokenRequest(body: body)
    }

    private func tokenRequest(body: [String: String]) async throws {
        var req = URLRequest(url: URL(string: "https://accounts.spotify.com/api/token")!)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        req.httpBody = body
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")" }
            .joined(separator: "&")
            .data(using: .utf8)

        let (data, _) = try await session.data(for: req)
        struct TokenResponse: Decodable {
            let access_token: String
            let refresh_token: String?
            let expires_in: Int
        }
        let resp = try JSONDecoder().decode(TokenResponse.self, from: data)
        self.accessToken = resp.access_token
        Keychain.set(resp.access_token, for: "spotify.access")
        if let r = resp.refresh_token {
            self.refreshToken = r
            Keychain.set(r, for: "spotify.refresh")
        }
    }

    // MARK: - Web API

    func refreshNowPlaying() async {
        do {
            let data = try await authedGet("/me/player")
            guard !data.isEmpty else { nowPlaying = nil; return }
            self.nowPlaying = parseNowPlaying(from: data)
        } catch {
            lastError = "now playing: \(error.localizedDescription)"
        }
    }

    func togglePlayPause() async {
        let path = (nowPlaying?.isPlaying ?? false) ? "/me/player/pause" : "/me/player/play"
        _ = try? await authedRequest(path: path, method: "PUT")
        await refreshNowPlaying()
    }

    func next() async {
        _ = try? await authedRequest(path: "/me/player/next", method: "POST")
        await refreshNowPlaying()
    }

    func previous() async {
        _ = try? await authedRequest(path: "/me/player/previous", method: "POST")
        await refreshNowPlaying()
    }

    func setVolume(_ percent: Int) async {
        let clamped = max(0, min(100, percent))
        _ = try? await authedRequest(path: "/me/player/volume?volume_percent=\(clamped)", method: "PUT")
    }

    // MARK: - Polling

    func startPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refreshNowPlaying()
                try? await Task.sleep(nanoseconds: 5_000_000_000)
            }
        }
    }

    // MARK: - Internals

    private func authedGet(_ path: String) async throws -> Data {
        try await authedRequest(path: path, method: "GET")
    }

    @discardableResult
    private func authedRequest(path: String, method: String) async throws -> Data {
        if accessToken == nil { try await refreshAccessToken() }
        guard let token = accessToken else { throw URLError(.userAuthenticationRequired) }

        var req = URLRequest(url: URL(string: "https://api.spotify.com/v1\(path)")!)
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse {
            if http.statusCode == 401 {
                try await refreshAccessToken()
                return try await authedRequest(path: path, method: method)
            }
            if http.statusCode == 204 { return Data() }
            guard (200..<300).contains(http.statusCode) else {
                throw NSError(domain: "Spotify", code: http.statusCode)
            }
        }
        return data
    }

    private func parseNowPlaying(from data: Data) -> SpotifyTrack? {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let item = obj["item"] as? [String: Any],
              let id = item["id"] as? String,
              let name = item["name"] as? String else { return nil }
        let artists = (item["artists"] as? [[String: Any]])?.compactMap { $0["name"] as? String } ?? []
        let album = item["album"] as? [String: Any]
        let albumName = album?["name"] as? String ?? ""
        let images = album?["images"] as? [[String: Any]] ?? []
        let artURL = (images.first?["url"] as? String).flatMap(URL.init)
        return SpotifyTrack(
            id: id,
            title: name,
            artist: artists.joined(separator: ", "),
            album: albumName,
            albumArtURL: artURL,
            durationMs: item["duration_ms"] as? Int ?? 0,
            progressMs: obj["progress_ms"] as? Int ?? 0,
            isPlaying: obj["is_playing"] as? Bool ?? false
        )
    }

    // MARK: - Web auth glue

    private func webAuth(url: URL, callbackScheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { url, error in
                if let url { continuation.resume(returning: url) }
                else { continuation.resume(throwing: error ?? URLError(.cancelled)) }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }

    // MARK: - PKCE helpers

    private static func randomString(length: Int) -> String {
        let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~"
        return String((0..<length).map { _ in chars.randomElement()! })
    }

    private static func codeChallenge(for verifier: String) -> String {
        let hash = SHA256.hash(data: Data(verifier.utf8))
        return Data(hash).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

extension SpotifyClient: ASWebAuthenticationPresentationContextProviding {
    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        // Use the key window — set on init from the main actor.
        DispatchQueue.main.sync {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first(where: { $0.isKeyWindow }) ?? ASPresentationAnchor()
        }
    }
}

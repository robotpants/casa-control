import SwiftUI
import UIKit

enum Theme {
    enum Surface {
        // Single-surface: bg and surface are identical in light mode.
        // In dark mode, surface is slightly lighter than bg for the gradient fallback.
        static let bg = dynamic(
            light: UIColor(red: 0xE2/255, green: 0xE4/255, blue: 0xEC/255, alpha: 1),
            dark:  UIColor(red: 0x1A/255, green: 0x1B/255, blue: 0x22/255, alpha: 1)
        )
        static let surface = dynamic(
            light: UIColor(red: 0xE2/255, green: 0xE4/255, blue: 0xEC/255, alpha: 1),
            dark:  UIColor(red: 0x2B/255, green: 0x2D/255, blue: 0x37/255, alpha: 1)
        )
    }

    enum TextColor {
        static let primary = dynamic(
            light: UIColor(red: 0x2C/255, green: 0x2E/255, blue: 0x3A/255, alpha: 1),
            dark:  UIColor(red: 0xE4/255, green: 0xE5/255, blue: 0xEB/255, alpha: 1)
        )
        static let secondary = dynamic(
            light: UIColor(red: 0x6B/255, green: 0x6E/255, blue: 0x7D/255, alpha: 1),
            dark:  UIColor(red: 0x9A/255, green: 0x9C/255, blue: 0xAA/255, alpha: 1)
        )
        static let muted = dynamic(
            light: UIColor(red: 0x7D/255, green: 0x80/255, blue: 0x92/255, alpha: 1),
            dark:  UIColor(red: 0x5E/255, green: 0x60/255, blue: 0x70/255, alpha: 1)
        )
    }

    enum Accent {
        static let ember = Color(red: 0xE8/255, green: 0x65/255, blue: 0x3A/255)
        static let glow = ember.opacity(0.35)
    }

    enum Semantic {
        static let success = Color(red: 0x3A/255, green: 0xBF/255, blue: 0x7A/255)
        static let warning = Color(red: 0xE8/255, green: 0xB8/255, blue: 0x3A/255)
        static let danger  = Color(red: 0xE8/255, green: 0x4A/255, blue: 0x3A/255)
    }

    /// Neumorphic shadow colors. Light direction = highlight; dark = shadow.
    enum Shadow {
        static let light = dynamic(
            light: UIColor.white.withAlphaComponent(0.72),
            dark:  UIColor(red: 0x46/255, green: 0x49/255, blue: 0x58/255, alpha: 0.45)
        )
        static let dark = dynamic(
            light: UIColor(red: 0xA3/255, green: 0xA7/255, blue: 0xB9/255, alpha: 0.55),
            dark:  UIColor.black.withAlphaComponent(0.90)
        )
        static let insetLight = dynamic(
            light: UIColor.white.withAlphaComponent(0.50),
            dark:  UIColor(red: 0x46/255, green: 0x49/255, blue: 0x58/255, alpha: 0.30)
        )
        static let insetDark = dynamic(
            light: UIColor(red: 0xA3/255, green: 0xA7/255, blue: 0xB9/255, alpha: 0.40),
            dark:  UIColor.black.withAlphaComponent(0.70)
        )
    }

    enum DeviceColor {
        static let warm2700 = Color(red: 0xFF/255, green: 0xD9/255, blue: 0xA8/255)
        static let soft3000 = Color(red: 0xFF/255, green: 0xE8/255, blue: 0xCC/255)
        static let day5000  = Color(red: 0xF5/255, green: 0xF0/255, blue: 0xE8/255)
        static let amber    = Color(red: 0xE8/255, green: 0xB8/255, blue: 0x3A/255)
        static let green    = Color(red: 0x3A/255, green: 0xBF/255, blue: 0x7A/255)
        static let blue     = Color(red: 0x3A/255, green: 0x8E/255, blue: 0xE8/255)
        static let purple   = Color(red: 0x9B/255, green: 0x59/255, blue: 0xB6/255)
        static let pink     = Color(red: 0xE8/255, green: 0x4A/255, blue: 0x7A/255)
        static let teal     = Color(red: 0x3A/255, green: 0xBF/255, blue: 0xB8/255)
    }

    enum Radius {
        static let sm: CGFloat = 12
        static let base: CGFloat = 18
        static let lg: CGFloat = 24
        static let pill: CGFloat = 999
    }

    enum Space {
        static let s1: CGFloat = 4
        static let s2: CGFloat = 8
        static let s3: CGFloat = 12
        static let s4: CGFloat = 14
        static let s5: CGFloat = 18
        static let s6: CGFloat = 24
        static let s7: CGFloat = 32
    }

    enum Layout {
        static let navHeight: CGFloat = 72
        static let maxAppWidth: CGFloat = 480
    }

    enum FontFamily {
        // Postscript names of bundled variable fonts. Fall back to system if absent.
        static let sans = "DMSans-Regular"
        static let display = "Outfit-Regular"
        static let mono = "JetBrainsMono-Regular"
    }

    enum Typography {
        static func display(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
            .custom(FontFamily.display, size: size).weight(weight)
        }
        static func sans(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
            .custom(FontFamily.sans, size: size).weight(weight)
        }
        static func mono(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
            .custom(FontFamily.mono, size: size).weight(weight)
        }

        static let h1 = display(24, weight: .semibold)
        static let h2 = display(20, weight: .semibold)
        static let h3 = sans(15, weight: .semibold)
        static let body = sans(14)
        static let sub = sans(13)
        static let caption = sans(11, weight: .medium)
        static let eyebrow = display(11, weight: .semibold)
        static let stat = display(22, weight: .medium)
    }

    private static func dynamic(light: UIColor, dark: UIColor) -> Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? dark : light
        })
    }
}

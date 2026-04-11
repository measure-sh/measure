import SwiftUI
import Measure

struct TechScreen: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let factory: () -> UIViewController
}

// MARK: - Theme colors matching Android MeasureTheme

private struct MeasureColors {
    let primary: Color
    let primaryContainer: Color
    let onPrimaryContainer: Color
    let background: Color
    let surface: Color
    let onSurface: Color
    let onSurfaceVariant: Color

    static let light = MeasureColors(
        primary: Color(red: 0x2E / 255.0, green: 0x7D / 255.0, blue: 0x32 / 255.0),
        primaryContainer: Color(red: 0xB8 / 255.0, green: 0xF5 / 255.0, blue: 0xB0 / 255.0),
        onPrimaryContainer: Color(red: 0x00 / 255.0, green: 0x22 / 255.0, blue: 0x04 / 255.0),
        background: Color(red: 0xFA / 255.0, green: 0xFA / 255.0, blue: 0xFA / 255.0),
        surface: Color.white,
        onSurface: Color(red: 0x1C / 255.0, green: 0x1B / 255.0, blue: 0x1F / 255.0),
        onSurfaceVariant: Color(red: 0x49 / 255.0, green: 0x45 / 255.0, blue: 0x4F / 255.0)
    )

    static let dark = MeasureColors(
        primary: Color(red: 0x66 / 255.0, green: 0xBB / 255.0, blue: 0x6A / 255.0),
        primaryContainer: Color(red: 0x1B / 255.0, green: 0x5E / 255.0, blue: 0x20 / 255.0),
        onPrimaryContainer: Color(red: 0xB8 / 255.0, green: 0xF5 / 255.0, blue: 0xB0 / 255.0),
        background: Color(red: 0x12 / 255.0, green: 0x12 / 255.0, blue: 0x12 / 255.0),
        surface: Color(red: 0x1E / 255.0, green: 0x1E / 255.0, blue: 0x1E / 255.0),
        onSurface: Color(red: 0xE6 / 255.0, green: 0xE1 / 255.0, blue: 0xE5 / 255.0),
        onSurfaceVariant: Color(red: 0xCA / 255.0, green: 0xC4 / 255.0, blue: 0xD0 / 255.0)
    )
}

// MARK: - Floating Orbs Background

private struct OrbSpec {
    let centerXRatio: CGFloat
    let centerYRatio: CGFloat
    let baseRadius: CGFloat
    let driftX: CGFloat
    let driftY: CGFloat
    let periodX: CGFloat
    let periodY: CGFloat
    let pulsePeriod: CGFloat
}

private let orbSpecs: [OrbSpec] = [
    OrbSpec(centerXRatio: 0.20, centerYRatio: 0.15, baseRadius: 140, driftX: 60, driftY: 40, periodX: 15, periodY: 19, pulsePeriod: 10),
    OrbSpec(centerXRatio: 0.80, centerYRatio: 0.25, baseRadius: 100, driftX: 50, driftY: 55, periodX: 18, periodY: 13, pulsePeriod: 12),
    OrbSpec(centerXRatio: 0.35, centerYRatio: 0.55, baseRadius: 160, driftX: 45, driftY: 50, periodX: 20, periodY: 17, pulsePeriod: 8),
    OrbSpec(centerXRatio: 0.70, centerYRatio: 0.80, baseRadius: 120, driftX: 55, driftY: 35, periodX: 14, periodY: 22, pulsePeriod: 14),
]

struct FloatingOrbsBackground: View {
    let orbColor: Color

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                for orb in orbSpecs {
                    let x = size.width * orb.centerXRatio
                        + orb.driftX * sin(t * 2 * .pi / orb.periodX)
                    let y = size.height * orb.centerYRatio
                        + orb.driftY * sin(t * 2 * .pi / orb.periodY + 0.5)
                    let r = orb.baseRadius
                        * (1.0 + 0.15 * sin(t * 2 * .pi / orb.pulsePeriod))
                    let rect = CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)
                    let gradient = Gradient(colors: [orbColor.opacity(0.25), .clear])
                    context.fill(
                        Circle().path(in: rect),
                        with: .radialGradient(
                            gradient,
                            center: CGPoint(x: x, y: y),
                            startRadius: 0,
                            endRadius: r
                        )
                    )
                }
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

// MARK: - Home Screen

class MeasureSDKState: ObservableObject {
    @Published var isRunning = true
}

struct HomeScreen: View {
    let screens: [TechScreen]
    let onNavigate: (TechScreen) -> Void
    @ObservedObject var sdkState: MeasureSDKState

    @Environment(\.colorScheme) private var colorScheme

    private var colors: MeasureColors {
        colorScheme == .dark ? .dark : .light
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            colors.background.ignoresSafeArea()
            FloatingOrbsBackground(orbColor: colors.primary)
            ScrollView {
                VStack(spacing: 12) {
                    sdkToggleCard
                    ForEach(screens) { screen in
                        screenCard(screen)
                    }
                }
                .padding(16)
            }

            HStack {
                Text(Bundle.main.bundleIdentifier ?? "")
                    .font(.caption2)
                    .foregroundStyle(colors.onSurfaceVariant)
                Spacer()
                Text(versionString)
                    .font(.caption2)
                    .foregroundStyle(colors.onSurfaceVariant)
            }
            .padding(16)
        }
        .onChange(of: sdkState.isRunning) { running in
            if running {
                Measure.start()
            } else {
                Measure.stop()
            }
        }
    }

    private var sdkToggleCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Measure SDK")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(colors.onPrimaryContainer)
                Text(sdkState.isRunning ? "Running" : "Stopped")
                    .font(.caption)
                    .foregroundStyle(colors.onPrimaryContainer.opacity(0.7))
            }
            Spacer()
            Toggle(isOn: $sdkState.isRunning) {
                EmptyView()
            }
            .labelsHidden()
            .tint(colors.primary)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(colors.primaryContainer.opacity(0.7))
        )
    }

    private func screenCard(_ screen: TechScreen) -> some View {
        Button {
            onNavigate(screen)
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(screen.title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(colors.onSurface)
                Text(screen.subtitle)
                    .font(.caption)
                    .foregroundStyle(colors.onSurfaceVariant)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(colors.surface.opacity(0.6))
            )
        }
    }

    private var versionString: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        return "v\(version) (\(build))"
    }
}

// MARK: - UIKit Wrapper

class HomeViewController: UIHostingController<HomeScreen> {
    private let sdkState: MeasureSDKState

    private static let screens: [TechScreen] = [
        TechScreen(title: "Native iOS", subtitle: "Swift + SwiftUI") {
            NativeIOSViewController()
        },
        TechScreen(title: "Compose Multiplatform", subtitle: "KMP + CMP") {
            CmpScreenViewController()
        },
        TechScreen(title: "Flutter", subtitle: "Dart + Flutter") {
            FlutterScreenViewController()
        },
        TechScreen(title: "React Native", subtitle: "JavaScript + React Native") {
            ReactNativeScreenViewController()
        },
    ]

    init() {
        let state = MeasureSDKState()
        self.sdkState = state
        super.init(rootView: HomeScreen(screens: Self.screens, onNavigate: { _ in }, sdkState: state))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        self.rootView = HomeScreen(screens: Self.screens, onNavigate: { [weak self] screen in
            let vc = screen.factory()
            vc.title = screen.title
            self?.navigationController?.pushViewController(vc, animated: true)
        }, sdkState: sdkState)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.setNavigationBarHidden(true, animated: animated)
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        navigationController?.setNavigationBarHidden(false, animated: animated)
    }
}

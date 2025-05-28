//
//  FloatingButtonViewController.swift
//  Measure
//
//  Created by Adwin Ross on 04/05/25.
//

import UIKit

protocol FloatingButtonViewControllerDelegate: AnyObject {
    func floatingButtonViewControllerDismissed(_ attachments: [Attachment])
}

final class FloatingButtonViewController: UIViewController {
    private let button = UIButton(type: .custom)
    private let badgeLabel = UILabel()
    private let screenshotGenerator: ScreenshotGenerator
    private let cancelButton = UIButton(type: .system)
    private let bugReportConfig: BugReportConfig
    private let bottomSafeArea: CGFloat = 30
    private let topSafeArea: CGFloat = 60
    private var attachments = [Attachment]()
    private let configProvider: ConfigProvider
    weak var delegate: FloatingButtonViewControllerDelegate?
    private var lastKnownBounds: CGRect = .zero

    override func loadView() {
        self.view = FloatingButtonContainerView(cancelButton: cancelButton, floatingButton: button)
    }

    init(screenshotGenerator: ScreenshotGenerator, bugReportConfig: BugReportConfig, attachments: [Attachment], configProvider: ConfigProvider) {
        self.screenshotGenerator = screenshotGenerator
        self.bugReportConfig = bugReportConfig
        self.attachments = attachments
        self.configProvider = configProvider

        if #available(iOS 13.0, *) {
            button.setImage(UIImage(systemName: "camera.fill"), for: .normal)
        }
        button.tintColor = bugReportConfig.colors.floatingButtonIcon
        button.backgroundColor = bugReportConfig.colors.floatingButtonBackground
        button.layer.cornerRadius = 25
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowRadius = 3
        button.layer.shadowOpacity = 0.8
        button.layer.shadowOffset = .zero

        // Set initial position to bottom right
        let screenBounds = UIScreen.main.bounds
        let buttonSize: CGFloat = 50
        let padding: CGFloat = 16
        button.frame = CGRect(
            x: screenBounds.maxX - buttonSize - padding,
            y: screenBounds.maxY - buttonSize - bottomSafeArea - padding,
            width: buttonSize,
            height: buttonSize
        )

        // Setup badge label
        badgeLabel.backgroundColor = bugReportConfig.colors.badgeColor
        badgeLabel.textColor = bugReportConfig.colors.badgeTextColor
        badgeLabel.font = UIFont.systemFont(ofSize: 14, weight: .bold)
        badgeLabel.textAlignment = .center
        badgeLabel.layer.cornerRadius = 12
        badgeLabel.clipsToBounds = true
        badgeLabel.isHidden = true
        button.addSubview(badgeLabel)

        super.init(nibName: nil, bundle: nil)

        setupView()
        updateBadge()
    }

    func addAttachment(_ attachment: Attachment) {
        if attachments.count < configProvider.maxAttachmentsInBugReport {
            self.attachments.append(attachment)
            updateBadge()
            if self.attachments.count == configProvider.maxAttachmentsInBugReport {
                dismiss()
            }
        } else {
            dismiss()
        }
    }

    func dismiss() {
        if let delegate = delegate {
            delegate.floatingButtonViewControllerDismissed(attachments)
            self.view.removeFromSuperview()
            self.removeFromParent()
        }
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupView() {
        view.backgroundColor = .clear
        view.isUserInteractionEnabled = true

        // Setup cancel butto
        cancelButton.setTitle(bugReportConfig.text.exitScreenshotMode, for: .normal)
        cancelButton.setTitleColor(bugReportConfig.colors.floatingExitButtonText, for: .normal)
        cancelButton.backgroundColor = bugReportConfig.colors.floatingButtonBackground
        cancelButton.addTarget(self, action: #selector(cancelButtonTapped), for: .touchUpInside)

        // Add subviews
        view.addSubview(cancelButton)
        view.addSubview(button)

        // Initial manual layout
        layoutCancelButton()

        // Add gesture recognizers
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        button.addGestureRecognizer(panGesture)

        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        button.addGestureRecognizer(tapGesture)
    }

    @objc private func cancelButtonTapped() {
        dismiss()
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: view)
        button.center = CGPoint(x: button.center.x + translation.x, y: button.center.y + translation.y)
        gesture.setTranslation(.zero, in: view)

        if gesture.state == .ended {
            snapToEdge()
        }
    }

    @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
        if let attachment = screenshotGenerator.generate(window: view.window!, name: screenshotName, storageType: .data) {
            animateScreenshotToButton(attachment)
        }
    }

    private func animateScreenshotToButton(_ attachment: Attachment) {
        guard let window = view.window, let imageData = attachment.bytes, let screenshot = UIImage(data: imageData) else { return }
        let startFrame = CGRect(x: 0, y: 0 - 80, width: window.bounds.width, height: window.bounds.height)
        let imageView = UIImageView(image: screenshot)
        imageView.frame = startFrame
        imageView.layer.cornerRadius = 12
        imageView.clipsToBounds = true
        imageView.contentMode = .scaleAspectFill
        window.addSubview(imageView)

        // Get the button's frame in window coordinates
        let buttonFrameInWindow = button.superview?.convert(button.frame, to: window) ?? .zero
        let targetCenter = CGPoint(x: buttonFrameInWindow.midX, y: buttonFrameInWindow.midY)

        UIView.animate(withDuration: 0.4, delay: 0, options: [.curveEaseIn], animations: {
            imageView.center = targetCenter
            imageView.transform = CGAffineTransform(scaleX: 0.1, y: 0.1)
            imageView.alpha = 0.2
        }, completion: { _ in
            imageView.removeFromSuperview()
            self.addAttachment(attachment)
        })
    }

    private func snapToEdge() {
        let screenBounds = UIScreen.main.bounds
        let buttonFrame = button.frame
        let buttonSize = buttonFrame.size
        let padding: CGFloat = 16

        // Calculate distances to each corner with padding
        let topLeftDistance = sqrt(pow(buttonFrame.minX - padding, 2) + pow(buttonFrame.minY - (topSafeArea + padding), 2))
        let topRightDistance = sqrt(pow(screenBounds.maxX - buttonFrame.maxX - padding, 2) + pow(buttonFrame.minY - (topSafeArea + padding), 2))
        let bottomLeftDistance = sqrt(pow(buttonFrame.minX - padding, 2) + pow(screenBounds.maxY - buttonFrame.maxY - (bottomSafeArea + padding), 2))
        let bottomRightDistance = sqrt(pow(screenBounds.maxX - buttonFrame.maxX - padding, 2) + pow(screenBounds.maxY - buttonFrame.maxY - (bottomSafeArea + padding), 2))

        // Find the closest corner
        let minDistance = min(topLeftDistance, topRightDistance, bottomLeftDistance, bottomRightDistance)

        UIView.animate(withDuration: 0.3) {
            switch minDistance {
            case topLeftDistance:
                self.button.frame.origin = CGPoint(x: padding, y: self.topSafeArea + padding)
            case topRightDistance:
                self.button.frame.origin = CGPoint(x: screenBounds.maxX - buttonSize.width - padding, y: self.topSafeArea + padding)
            case bottomLeftDistance:
                self.button.frame.origin = CGPoint(x: padding, y: screenBounds.maxY - buttonSize.height - (self.bottomSafeArea + padding))
            case bottomRightDistance:
                self.button.frame.origin = CGPoint(x: screenBounds.maxX - buttonSize.width - padding, y: screenBounds.maxY - buttonSize.height - (self.bottomSafeArea + padding))
            default:
                break
            }
        }
    }

    private func updateBadge() {
        badgeLabel.isHidden = attachments.isEmpty
        badgeLabel.text = "\(attachments.count)"
        let badgeSize: CGFloat = 24
        badgeLabel.frame = CGRect(
            x: button.bounds.width - badgeSize * 0.6,
            y: -badgeSize * 0.3,
            width: badgeSize,
            height: badgeSize
        )
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        NotificationCenter.default.addObserver(self, selector: #selector(handleOrientationOrBoundsChange), name: UIDevice.orientationDidChangeNotification, object: nil)
    }

    @objc private func handleOrientationOrBoundsChange() {
        DispatchQueue.main.async {
            self.snapToEdge()
            self.layoutCancelButton()
        }
    }

    private func layoutCancelButton() {
        let buttonHeight: CGFloat = 24
        self.cancelButton.frame = CGRect(x: 0,
                                         y: self.view.safeAreaInsets.top + self.bugReportConfig.dimensions.topPadding,
                                         width: UIScreen.main.bounds.width,
                                         height: buttonHeight)
        self.cancelButton.setNeedsLayout()
        self.cancelButton.layoutIfNeeded()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        layoutCancelButton()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}

private class FloatingButtonContainerView: UIView {
    private weak var cancelButton: UIButton?
    private weak var floatingButton: UIButton?

    init(cancelButton: UIButton, floatingButton: UIButton) {
        self.cancelButton = cancelButton
        self.floatingButton = floatingButton
        super.init(frame: .zero)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        return (cancelButton?.frame.contains(point) ?? false) ||
               (floatingButton?.frame.contains(point) ?? false)
    }
}

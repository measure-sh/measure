//
//  FloatingButtonViewController.swift
//  Measure
//
//  Created by Adwin Ross on 04/05/25.
//

import UIKit

protocol FloatingButtonViewControllerDelegate: AnyObject {
    func floatingButtonViewController(_ attachment: Attachment)
    func floatingButtonViewControllerDismissed()
}

final class FloatingButtonViewController: UIViewController {
    private let button: UIButton
    private let screenshotGenerator: ScreenshotGenerator
    private let cancelButton = UIButton(type: .system)
    private let bugReportConfig: BugReportConfig
    private let bottomSafeArea: CGFloat = 30
    private let topSafeArea: CGFloat = 60
    weak var delegate: FloatingButtonViewControllerDelegate?

    init(screenshotGenerator: ScreenshotGenerator, bugReportConfig: BugReportConfig) {
        self.screenshotGenerator = screenshotGenerator
        self.bugReportConfig = bugReportConfig

        button = UIButton(type: .custom)
        if #available(iOS 13.0, *) {
            button.setImage(UIImage(systemName: "camera.fill"), for: .normal)
        }
        button.tintColor = bugReportConfig.colors.floatingButtonIcon
        button.backgroundColor = bugReportConfig.colors.floatingButtonBackground
        button.layer.cornerRadius = bugReportConfig.dimensions.floatingButtonCornerRadius
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowRadius = 3
        button.layer.shadowOpacity = 0.8
        button.layer.shadowOffset = .zero

        // Set initial position to bottom right
        let screenBounds = UIScreen.main.bounds
        let buttonSize = bugReportConfig.dimensions.floatingButtonSize
        let padding = bugReportConfig.dimensions.floatingButtonPadding
        button.frame = CGRect(
            x: screenBounds.maxX - buttonSize - padding,
            y: screenBounds.maxY - buttonSize - bottomSafeArea - padding,
            width: buttonSize,
            height: buttonSize
        )

        super.init(nibName: nil, bundle: nil)

        setupView()
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

        // Setup constraints
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: bugReportConfig.dimensions.topPadding),
            cancelButton.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 0),
            cancelButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: 0)
        ])

        // Add gesture recognizers
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        button.addGestureRecognizer(panGesture)

        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        button.addGestureRecognizer(tapGesture)
    }

    @objc private func cancelButtonTapped() {
        // Remove the floating button controller
        self.view.removeFromSuperview()
        self.removeFromParent()
        delegate?.floatingButtonViewControllerDismissed()
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
            delegate?.floatingButtonViewController(attachment)
        }
        self.view.removeFromSuperview()
        self.removeFromParent()
    }

    private func snapToEdge() {
        let screenBounds = UIScreen.main.bounds
        let buttonFrame = button.frame
        let buttonSize = buttonFrame.size
        let padding = bugReportConfig.dimensions.floatingButtonPadding

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
}

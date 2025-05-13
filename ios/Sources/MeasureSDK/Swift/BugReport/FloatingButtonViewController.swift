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

class FloatingButtonViewController: UIViewController {
    private let button: UIButton
    private let screenshotGenerator: ScreenshotGenerator
    private let topPaddingConstant: CGFloat = 20
    weak var delegate: FloatingButtonViewControllerDelegate?

    init(screenshotGenerator: ScreenshotGenerator) {
        self.screenshotGenerator = screenshotGenerator

        button = UIButton(type: .custom)
        if #available(iOS 13.0, *) {
            button.setImage(UIImage(systemName: "camera.fill"), for: .normal)
        }
        button.tintColor = .white
        button.backgroundColor = .systemBlue
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
            y: screenBounds.maxY - buttonSize - 30 - padding,
            width: buttonSize,
            height: buttonSize
        )

        super.init(nibName: nil, bundle: nil)

        // Create and set the custom view
        let floatingView = FloatingButtonView(button: button, topPaddingConstant: topPaddingConstant)
        floatingView.cancelButton.addTarget(self, action: #selector(cancelButtonTapped), for: .touchUpInside)
        self.view = floatingView

        // Add gesture recognizers
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        button.addGestureRecognizer(panGesture)

        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        button.addGestureRecognizer(tapGesture)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
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
        let padding: CGFloat = 16

        // Calculate distances to each corner with padding
        let topLeftDistance = sqrt(pow(buttonFrame.minX - padding, 2) + pow(buttonFrame.minY - (60 + padding), 2))
        let topRightDistance = sqrt(pow(screenBounds.maxX - buttonFrame.maxX - padding, 2) + pow(buttonFrame.minY - (60 + padding), 2))
        let bottomLeftDistance = sqrt(pow(buttonFrame.minX - padding, 2) + pow(screenBounds.maxY - buttonFrame.maxY - (30 + padding), 2))
        let bottomRightDistance = sqrt(pow(screenBounds.maxX - buttonFrame.maxX - padding, 2) + pow(screenBounds.maxY - buttonFrame.maxY - (30 + padding), 2))

        // Find the closest corner
        let minDistance = min(topLeftDistance, topRightDistance, bottomLeftDistance, bottomRightDistance)

        UIView.animate(withDuration: 0.3) {
            switch minDistance {
            case topLeftDistance:
                self.button.frame.origin = CGPoint(x: padding, y: 60 + padding)
            case topRightDistance:
                self.button.frame.origin = CGPoint(x: screenBounds.maxX - buttonSize.width - padding, y: 60 + padding)
            case bottomLeftDistance:
                self.button.frame.origin = CGPoint(x: padding, y: screenBounds.maxY - buttonSize.height - (30 + padding))
            case bottomRightDistance:
                self.button.frame.origin = CGPoint(x: screenBounds.maxX - buttonSize.width - padding, y: screenBounds.maxY - buttonSize.height - (30 + padding))
            default:
                break
            }
        }
    }
}

class FloatingButtonView: UIView {
    private let button: UIButton
    let cancelButton: UIButton
    private let topPaddingConstant: CGFloat

    init(button: UIButton, topPaddingConstant: CGFloat) {
        self.button = button
        self.topPaddingConstant = topPaddingConstant

        cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Tap to exit Screenshot mode", for: .normal)
        cancelButton.setTitleColor(.white, for: .normal)
        cancelButton.backgroundColor = .systemBlue

        super.init(frame: .zero)
        self.backgroundColor = .clear
        self.isUserInteractionEnabled = true

        self.addSubview(cancelButton)
        self.addSubview(button)

        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: self.safeAreaLayoutGuide.topAnchor, constant: topPaddingConstant),
            cancelButton.leadingAnchor.constraint(equalTo: self.safeAreaLayoutGuide.leadingAnchor, constant: 0),
            cancelButton.trailingAnchor.constraint(equalTo: self.safeAreaLayoutGuide.trailingAnchor, constant: 0)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        return button.frame.contains(point) || cancelButton.frame.contains(point)
    }
}

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
    weak var delegate: FloatingButtonViewControllerDelegate?

    init(screenshotGenerator: ScreenshotGenerator) {
        // Create the button
        button = UIButton(type: .custom)
        button.setTitle("Floating", for: .normal)
        button.setTitleColor(.green, for: .normal)
        button.backgroundColor = .white
        button.layer.cornerRadius = 25
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowRadius = 3
        button.layer.shadowOpacity = 0.8
        button.layer.shadowOffset = .zero
        button.frame = CGRect(x: 100, y: 100, width: 50, height: 50)
        self.screenshotGenerator = screenshotGenerator

        super.init(nibName: nil, bundle: nil)

        // Create and set the custom view
        let floatingView = FloatingButtonView(button: button)
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
        if let attachment = screenshotGenerator.generate(window: view.window!, name: "FloatingButton", storageType: .data) {
            delegate?.floatingButtonViewController(attachment)
        }
        self.view.removeFromSuperview()
        self.removeFromParent()
    }

    private func snapToEdge() {
        let screenBounds = UIScreen.main.bounds
        let buttonFrame = button.frame

        // Calculate distances to each edge
        let leftDistance = buttonFrame.minX
        let rightDistance = screenBounds.maxX - buttonFrame.maxX
        let topDistance = buttonFrame.minY
        let bottomDistance = screenBounds.maxY - buttonFrame.maxY

        // Find the closest edge
        let minDistance = min(leftDistance, rightDistance, topDistance, bottomDistance)

        UIView.animate(withDuration: 0.3) {
            switch minDistance {
            case leftDistance:
                self.button.frame.origin.x = 0
            case rightDistance:
                self.button.frame.origin.x = screenBounds.maxX - self.button.frame.width
            case topDistance:
                self.button.frame.origin.y = 60
            case bottomDistance:
                self.button.frame.origin.y = screenBounds.maxY - self.button.frame.height - 30
            default:
                break
            }
        }
    }
}

class FloatingButtonView: UIView {
    let button: UIButton
    let cancelButton: UIButton
    private let borderView: UIView

    init(button: UIButton) {
        self.button = button

        // Create done button
        cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(.white, for: .normal)
        cancelButton.backgroundColor = .systemBlue
        cancelButton.layer.cornerRadius = 8
        cancelButton.contentEdgeInsets = UIEdgeInsets(top: 8, left: 16, bottom: 8, right: 16)

        // Create border view
        borderView = UIView()
        borderView.backgroundColor = .clear
        borderView.layer.borderColor = UIColor.systemBlue.cgColor
        borderView.layer.borderWidth = 2
        borderView.layer.cornerRadius = 12

        super.init(frame: .zero)
        self.backgroundColor = .clear
        self.isUserInteractionEnabled = true

        // Add subviews in correct order
        self.addSubview(borderView)
        self.addSubview(button)
        self.addSubview(cancelButton)

        // Position done button
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: self.safeAreaLayoutGuide.topAnchor, constant: 16),
            cancelButton.trailingAnchor.constraint(equalTo: self.safeAreaLayoutGuide.trailingAnchor, constant: -16)
        ])

        // Position border view
        borderView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            borderView.topAnchor.constraint(equalTo: cancelButton.topAnchor, constant: 0),
            borderView.leadingAnchor.constraint(equalTo: self.safeAreaLayoutGuide.leadingAnchor, constant: 0),
            borderView.trailingAnchor.constraint(equalTo: self.safeAreaLayoutGuide.trailingAnchor, constant: 0),
            borderView.bottomAnchor.constraint(equalTo: self.safeAreaLayoutGuide.bottomAnchor, constant: 0)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        return button.frame.contains(point) || cancelButton.frame.contains(point)
    }
}

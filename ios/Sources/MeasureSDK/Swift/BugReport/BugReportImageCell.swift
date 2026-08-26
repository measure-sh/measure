//
//  BugReportImageCell.swift
//  Measure
//
//  Created by Adwin Ross on 12/05/25.
//

import UIKit

class BugReportImageCell: UICollectionViewCell {
    private let containerView = UIView()
    private let screenshotImageView = UIImageView()
    private let deleteButton = UIButton(type: .system)
    var onDelete: (() -> Void)?
    private var colors: MsrColors = BugReportConfig.default.colors

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupViews() {
        backgroundColor = .clear

        containerView.layer.cornerRadius = 8
        containerView.layer.borderWidth = 1
        containerView.clipsToBounds = true
        containerView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(containerView)

        screenshotImageView.contentMode = .scaleAspectFit
        screenshotImageView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(screenshotImageView)

        deleteButton.setImage(UIImage(systemName: "xmark.circle.fill"), for: .normal)
        deleteButton.layer.cornerRadius = 12
        deleteButton.translatesAutoresizingMaskIntoConstraints = false
        deleteButton.addTarget(self, action: #selector(deleteButtonTapped), for: .touchUpInside)
        containerView.addSubview(deleteButton)

        applyColors()

        NSLayoutConstraint.activate([
            containerView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            containerView.topAnchor.constraint(equalTo: contentView.topAnchor),
            containerView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),

            screenshotImageView.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            screenshotImageView.centerYAnchor.constraint(equalTo: containerView.centerYAnchor),
            screenshotImageView.widthAnchor.constraint(equalTo: containerView.widthAnchor, multiplier: 0.8),
            screenshotImageView.heightAnchor.constraint(equalTo: containerView.heightAnchor, multiplier: 0.8),

            deleteButton.widthAnchor.constraint(equalToConstant: 24),
            deleteButton.heightAnchor.constraint(equalToConstant: 24),
            deleteButton.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 4),
            deleteButton.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -4)
        ])
    }

    private func applyColors() {
        containerView.backgroundColor = colors.background
        containerView.layer.borderColor = colors.placeholder.cgColor
        deleteButton.tintColor = colors.text
        deleteButton.backgroundColor = colors.buttonBackground
    }

    func configure(with image: UIImage, colors: MsrColors) {
        self.colors = colors
        screenshotImageView.image = image
        applyColors()
    }

    @objc private func deleteButtonTapped() {
        onDelete?()
    }
}

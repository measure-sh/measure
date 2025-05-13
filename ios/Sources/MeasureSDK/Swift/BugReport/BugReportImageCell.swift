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
    private var isDarkModeEnabled: Bool = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupViews() {
        backgroundColor = .clear

        containerView.backgroundColor = isDarkModeEnabled ? UIColor(white: 0.15, alpha: 1) : .white
        containerView.layer.cornerRadius = 8
        containerView.layer.borderWidth = 1
        containerView.layer.borderColor = isDarkModeEnabled ? UIColor.gray.cgColor : UIColor.lightGray.cgColor
        containerView.clipsToBounds = true
        containerView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(containerView)

        screenshotImageView.contentMode = .scaleAspectFit
        screenshotImageView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(screenshotImageView)

        if #available(iOS 13.0, *) {
            deleteButton.setImage(UIImage(systemName: "xmark.circle.fill"), for: .normal)
        }
        deleteButton.tintColor = isDarkModeEnabled ? .white : .black
        deleteButton.backgroundColor = isDarkModeEnabled ? UIColor(white: 0, alpha: 0.5) : UIColor(white: 1, alpha: 0.5)
        deleteButton.layer.cornerRadius = 12
        deleteButton.translatesAutoresizingMaskIntoConstraints = false
        deleteButton.addTarget(self, action: #selector(deleteButtonTapped), for: .touchUpInside)
        containerView.addSubview(deleteButton)

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

    func configure(with image: UIImage, isDarkModeEnabled: Bool) {
        self.isDarkModeEnabled = isDarkModeEnabled
        screenshotImageView.image = image

        // Update colors based on mode
        containerView.backgroundColor = isDarkModeEnabled ? UIColor(white: 0.15, alpha: 1) : .white
        containerView.layer.borderColor = isDarkModeEnabled ? UIColor.gray.cgColor : UIColor.lightGray.cgColor
        deleteButton.tintColor = isDarkModeEnabled ? .white : .black
        deleteButton.backgroundColor = isDarkModeEnabled ? UIColor(white: 0, alpha: 0.5) : UIColor(white: 1, alpha: 0.5)
    }

    @objc private func deleteButtonTapped() {
        onDelete?()
    }
}

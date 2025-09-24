//
//  BugReportingViewController.swift
//  Measure
//
//  Created by Adwin Ross on 05/05/25.
//

import UIKit

protocol BugReportingViewControllerDelegate: AnyObject {
    func bugReportingViewControllerDidDismiss(_ description: String?, attachments: [MsrAttachment]?)
    func bugReportingViewControllerDidRequestScreenshot(_ description: String?, attachments: [MsrAttachment])
}

class BugReportingViewController: UIViewController, UINavigationControllerDelegate {
    weak var delegate: BugReportingViewControllerDelegate?
    private let navBar = UIView()
    private let cancelButton = UIButton(type: .system)
    private let titleLabel = UILabel()
    private let sendButton = UIButton(type: .system)
    private let textView = UITextView()
    private let placeholderLabel = UILabel()
    private let configProvider: ConfigProvider
    private let bugReportConfig: BugReportConfig
    private let idProvider: IdProvider

    private let imagesCollectionView: UICollectionView = {
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .horizontal
        layout.minimumLineSpacing = 12
        let collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.backgroundColor = .clear
        collectionView.showsHorizontalScrollIndicator = false
        return collectionView
    }()
    private let maxAttachmentsLabel = UILabel()
    private var attachments: [MsrAttachment]

    private let screenshotButton = UIButton(type: .system)
    private let galleryButton = UIButton(type: .system)

    private var screenshotButtonBottomConstraint: NSLayoutConstraint?
    private var galleryButtonBottomConstraint: NSLayoutConstraint?
    private var textViewHeightConstraint: NSLayoutConstraint?
    private var screenshotButtonToCollectionConstraint: NSLayoutConstraint?
    private var galleryButtonTopToCollectionConstraint: NSLayoutConstraint?
    private var screenshotButtonTopToLabelConstraint: NSLayoutConstraint?
    private var galleryButtonTopToLabelConstraint: NSLayoutConstraint?

    init(description: String?, attachments: [MsrAttachment] = [], configProvider: ConfigProvider, bugReportConfig: BugReportConfig, idProvider: IdProvider) {
        self.textView.text = description
        placeholderLabel.isHidden = !textView.text.isEmpty
        self.attachments = attachments
        self.configProvider = configProvider
        self.bugReportConfig = bugReportConfig
        self.idProvider = idProvider
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = bugReportConfig.colors.background

        setupNavBar()
        setupTextView()
        setupImagesCollectionView()
        setupMaxAttachmentsLabel()
        setupActionButtons()
        setupConstraints()

        imagesCollectionView.reloadData()
        updateConstraints(for: view.bounds.size)
    }

    private func setupNavBar() {
        navBar.backgroundColor = bugReportConfig.colors.background
        navBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(navBar)

        // Cancel button with cross icon
        if #available(iOS 13.0, *) {
            cancelButton.setImage(UIImage(systemName: "xmark"), for: .normal)
        }
        cancelButton.setTitle(nil, for: .normal)
        cancelButton.tintColor = bugReportConfig.colors.text
        cancelButton.backgroundColor = bugReportConfig.colors.buttonBackground
        cancelButton.layer.cornerRadius = 16
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        navBar.addSubview(cancelButton)

        // Title
        titleLabel.text = bugReportConfig.text.reportBugTitle
        titleLabel.textColor = bugReportConfig.colors.text
        titleLabel.font = bugReportConfig.fonts.title
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        navBar.addSubview(titleLabel)

        // Send button
        sendButton.setTitle(bugReportConfig.text.sendButton, for: .normal)
        sendButton.titleLabel?.font = bugReportConfig.fonts.button
        sendButton.translatesAutoresizingMaskIntoConstraints = false
        sendButton.addTarget(self, action: #selector(sentTapped), for: .touchUpInside)
        sendButton.isEnabled = placeholderLabel.isHidden
        sendButton.setTitleColor(sendButton.isEnabled ? bugReportConfig.colors.text : bugReportConfig.colors.placeholder, for: .normal)
        navBar.addSubview(sendButton)
    }

    @objc private func cancelTapped() {
        self.dismiss(animated: true) {
            guard let delegate = self.delegate else { return }
            delegate.bugReportingViewControllerDidDismiss(nil, attachments: nil)
        }
    }

    @objc private func sentTapped() {
        guard !textView.text.isEmpty && !attachments.isEmpty else { return }
        self.dismiss(animated: true) { [weak self] in
            guard let delegate = self?.delegate,
                  let text = self?.textView.text,
                  !text.isEmpty,
                  let attachment = self?.attachments,
                  !attachment.isEmpty else { return }
            delegate.bugReportingViewControllerDidDismiss(text, attachments: attachment)
        }
    }

    private func setupTextView() {
        textView.backgroundColor = .clear
        textView.textColor = bugReportConfig.colors.text
        textView.font = bugReportConfig.fonts.placeholder
        textView.delegate = self
        textView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(textView)

        placeholderLabel.text = bugReportConfig.text.descriptionPlaceholder
        placeholderLabel.textColor = bugReportConfig.colors.placeholder
        placeholderLabel.font = bugReportConfig.fonts.placeholder
        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(placeholderLabel)
    }

    private func setupImagesCollectionView() {
        imagesCollectionView.delegate = self
        imagesCollectionView.dataSource = self
        imagesCollectionView.register(BugReportImageCell.self, forCellWithReuseIdentifier: "ImageCell")
        imagesCollectionView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(imagesCollectionView)
    }

    private func setupMaxAttachmentsLabel() {
        maxAttachmentsLabel.text = "Max attachments added"
        maxAttachmentsLabel.textColor = bugReportConfig.colors.placeholder
        maxAttachmentsLabel.font = bugReportConfig.fonts.button
        maxAttachmentsLabel.textAlignment = .center
        maxAttachmentsLabel.translatesAutoresizingMaskIntoConstraints = false
        maxAttachmentsLabel.isHidden = attachments.count < configProvider.maxAttachmentsInBugReport
        view.addSubview(maxAttachmentsLabel)
    }

    private func setupActionButtons() {
        // Configure screenshot button
        if #available(iOS 13.0, *) {
            let screenshotConfig = UIImage.SymbolConfiguration(pointSize: 14, weight: .medium)
            let screenshotImage = UIImage(systemName: "camera.fill", withConfiguration: screenshotConfig)
            screenshotButton.setImage(screenshotImage, for: .normal)
            screenshotButton.imageEdgeInsets = UIEdgeInsets(top: 0, left: -8, bottom: 0, right: 0)
            screenshotButton.titleEdgeInsets = UIEdgeInsets(top: 0, left: 8, bottom: 0, right: -8)
        }
        screenshotButton.setTitle(bugReportConfig.text.screenshotButton, for: .normal)
        screenshotButton.setTitleColor(bugReportConfig.colors.text, for: .normal)
        screenshotButton.tintColor = bugReportConfig.colors.text
        screenshotButton.backgroundColor = bugReportConfig.colors.buttonBackground
        screenshotButton.layer.cornerRadius = 20
        screenshotButton.titleLabel?.font = bugReportConfig.fonts.button
        screenshotButton.translatesAutoresizingMaskIntoConstraints = false
        screenshotButton.addTarget(self, action: #selector(screenshotButtonTapped), for: .touchUpInside)
        screenshotButton.isEnabled = attachments.count < configProvider.maxAttachmentsInBugReport
        view.addSubview(screenshotButton)

        // Configure gallery button
        if #available(iOS 13.0, *) {
            let galleryConfig = UIImage.SymbolConfiguration(pointSize: 14, weight: .medium)
            let galleryImage = UIImage(systemName: "photo.fill", withConfiguration: galleryConfig)
            galleryButton.setImage(galleryImage, for: .normal)
            galleryButton.imageEdgeInsets = UIEdgeInsets(top: 0, left: -8, bottom: 0, right: 0)
            galleryButton.titleEdgeInsets = UIEdgeInsets(top: 0, left: 8, bottom: 0, right: -8)
        }
        galleryButton.setTitle(bugReportConfig.text.galleryButton, for: .normal)
        galleryButton.setTitleColor(bugReportConfig.colors.text, for: .normal)
        galleryButton.tintColor = bugReportConfig.colors.text
        galleryButton.backgroundColor = bugReportConfig.colors.buttonBackground
        galleryButton.layer.cornerRadius = 20
        galleryButton.titleLabel?.font = bugReportConfig.fonts.button
        galleryButton.translatesAutoresizingMaskIntoConstraints = false
        galleryButton.addTarget(self, action: #selector(galleryButtonTapped), for: .touchUpInside)
        galleryButton.isEnabled = attachments.count < configProvider.maxAttachmentsInBugReport
        view.addSubview(galleryButton)
        updateActionButtonsState()
    }

    @objc private func screenshotButtonTapped() {
        // Dismiss and notify delegate
        self.dismiss(animated: true) { [weak self] in
            guard let self = self else { return }
            self.delegate?.bugReportingViewControllerDidRequestScreenshot(textView.text, attachments: self.attachments)
        }
    }

    @objc private func galleryButtonTapped() {
        let imagePicker = UIImagePickerController()
        imagePicker.delegate = self
        imagePicker.sourceType = .photoLibrary
        imagePicker.allowsEditing = true
        present(imagePicker, animated: true)
    }

    private func setupConstraints() { // swiftlint:disable:this function_body_length
        let safeArea = view.safeAreaLayoutGuide

        NSLayoutConstraint.activate([
            // NavBar
            navBar.topAnchor.constraint(equalTo: safeArea.topAnchor),
            navBar.leadingAnchor.constraint(equalTo: safeArea.leadingAnchor),
            navBar.trailingAnchor.constraint(equalTo: safeArea.trailingAnchor),
            navBar.heightAnchor.constraint(equalToConstant: 56),

            cancelButton.leadingAnchor.constraint(equalTo: navBar.leadingAnchor, constant: 8),
            cancelButton.centerYAnchor.constraint(equalTo: navBar.centerYAnchor),
            cancelButton.widthAnchor.constraint(equalToConstant: 32),
            cancelButton.heightAnchor.constraint(equalToConstant: 32),

            titleLabel.centerXAnchor.constraint(equalTo: navBar.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: navBar.centerYAnchor),

            sendButton.trailingAnchor.constraint(equalTo: navBar.trailingAnchor, constant: -12),
            sendButton.centerYAnchor.constraint(equalTo: navBar.centerYAnchor),

            // TextView
            textView.topAnchor.constraint(equalTo: navBar.bottomAnchor, constant: 8),
            textView.leadingAnchor.constraint(equalTo: safeArea.leadingAnchor, constant: 16),
            textView.trailingAnchor.constraint(equalTo: safeArea.trailingAnchor, constant: -16),

            placeholderLabel.leadingAnchor.constraint(equalTo: textView.leadingAnchor, constant: 5),
            placeholderLabel.topAnchor.constraint(equalTo: textView.topAnchor, constant: 8),

            // Images CollectionView
            imagesCollectionView.leadingAnchor.constraint(equalTo: safeArea.leadingAnchor, constant: 16),
            imagesCollectionView.topAnchor.constraint(equalTo: textView.bottomAnchor, constant: 16),
            imagesCollectionView.trailingAnchor.constraint(equalTo: safeArea.trailingAnchor, constant: -16),
            imagesCollectionView.heightAnchor.constraint(equalToConstant: 140),

            // Max Attachments Label
            maxAttachmentsLabel.leadingAnchor.constraint(equalTo: safeArea.leadingAnchor, constant: 16),
            maxAttachmentsLabel.trailingAnchor.constraint(equalTo: safeArea.trailingAnchor, constant: -16),
            maxAttachmentsLabel.topAnchor.constraint(equalTo: imagesCollectionView.bottomAnchor, constant: 4),
            maxAttachmentsLabel.heightAnchor.constraint(equalToConstant: 22),

            // Action buttons (horizontal constraints)
            screenshotButton.leadingAnchor.constraint(equalTo: safeArea.leadingAnchor, constant: 16),
            screenshotButton.heightAnchor.constraint(equalToConstant: 44),
            screenshotButton.trailingAnchor.constraint(equalTo: galleryButton.leadingAnchor, constant: -16),
            screenshotButton.widthAnchor.constraint(equalTo: galleryButton.widthAnchor, multiplier: 1.0),
            galleryButton.trailingAnchor.constraint(equalTo: safeArea.trailingAnchor, constant: -16),
            galleryButton.heightAnchor.constraint(equalToConstant: 44)
        ])

        screenshotButtonBottomConstraint = screenshotButton.bottomAnchor.constraint(equalTo: safeArea.bottomAnchor, constant: -8)
        galleryButtonBottomConstraint = galleryButton.bottomAnchor.constraint(equalTo: safeArea.bottomAnchor, constant: -8)
        textViewHeightConstraint = textView.heightAnchor.constraint(equalToConstant: 120)

        // Top constraints for buttons (to collection view and to label)
        screenshotButtonToCollectionConstraint = screenshotButton.topAnchor.constraint(equalTo: imagesCollectionView.bottomAnchor, constant: 12)
        galleryButtonTopToCollectionConstraint = galleryButton.topAnchor.constraint(equalTo: imagesCollectionView.bottomAnchor, constant: 12)
        screenshotButtonTopToLabelConstraint = screenshotButton.topAnchor.constraint(equalTo: maxAttachmentsLabel.bottomAnchor, constant: 8)
        galleryButtonTopToLabelConstraint = galleryButton.topAnchor.constraint(equalTo: maxAttachmentsLabel.bottomAnchor, constant: 8)

        if attachments.count < configProvider.maxAttachmentsInBugReport {
            screenshotButtonTopToLabelConstraint?.isActive = false
            galleryButtonTopToLabelConstraint?.isActive = false
            screenshotButtonToCollectionConstraint?.isActive = true
            galleryButtonTopToCollectionConstraint?.isActive = true
        } else {
            screenshotButtonToCollectionConstraint?.isActive = false
            galleryButtonTopToCollectionConstraint?.isActive = false
            screenshotButtonTopToLabelConstraint?.isActive = true
            galleryButtonTopToLabelConstraint?.isActive = true
        }
    }

    func addAttachment(_ attachment: MsrAttachment) {
        guard attachments.count < configProvider.maxAttachmentsInBugReport else { return }
        attachments.append(attachment)
        imagesCollectionView.reloadData()
        updateActionButtonsState()
    }

    private func updateActionButtonsState() {
        let isEnabled = attachments.count < configProvider.maxAttachmentsInBugReport
        screenshotButton.isEnabled = isEnabled
        galleryButton.isEnabled = isEnabled

        let buttonColor = isEnabled ? bugReportConfig.colors.text : bugReportConfig.colors.placeholder
        screenshotButton.setTitleColor(buttonColor, for: .normal)
        galleryButton.setTitleColor(buttonColor, for: .normal)

        maxAttachmentsLabel.isHidden = isEnabled

        // Toggle constraints
        if maxAttachmentsLabel.isHidden {
            screenshotButtonTopToLabelConstraint?.isActive = false
            galleryButtonTopToLabelConstraint?.isActive = false
            screenshotButtonToCollectionConstraint?.isActive = true
            galleryButtonTopToCollectionConstraint?.isActive = true
        } else {
            screenshotButtonToCollectionConstraint?.isActive = false
            galleryButtonTopToCollectionConstraint?.isActive = false
            screenshotButtonTopToLabelConstraint?.isActive = true
            galleryButtonTopToLabelConstraint?.isActive = true
        }
}

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: { _ in
            self.updateConstraints(for: size)
        })
    }

    private func updateConstraints(for size: CGSize) {
        let isLandscape = size.height < size.width
        #if !targetEnvironment(macCatalyst)
        if UIDevice.current.userInterfaceIdiom == .phone {
            screenshotButtonBottomConstraint?.isActive = isLandscape
            galleryButtonBottomConstraint?.isActive = isLandscape
            textViewHeightConstraint?.constant = isLandscape ? 60 : 120
        }
        #endif
        textViewHeightConstraint?.isActive = true
    }
}

// MARK: - UITextViewDelegate
extension BugReportingViewController: UITextViewDelegate {
    func textViewDidChange(_ textView: UITextView) {
        let isTextAdded = !textView.text.isEmpty
        placeholderLabel.isHidden = isTextAdded
        sendButton.isEnabled = isTextAdded
        sendButton.setTitleColor(isTextAdded ? bugReportConfig.colors.text : bugReportConfig.colors.placeholder, for: .normal)
    }

    func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText string: String) -> Bool {
        let currentText = textView.text as NSString
        let newText = currentText.replacingCharacters(in: range, with: string)
        return newText.count <= configProvider.maxDescriptionLengthInBugReport
    }
}

// MARK: - UICollectionViewDataSource
extension BugReportingViewController: UICollectionViewDataSource {
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        return attachments.count
    }

    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        guard let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "ImageCell", for: indexPath) as? BugReportImageCell else {
            return UICollectionViewCell()
        }
        if let data = attachments[indexPath.item].bytes, let image = UIImage(data: data) {
            cell.configure(with: image, isDarkModeEnabled: false)
            cell.onDelete = { [weak self] in
                self?.attachments.remove(at: indexPath.item)
                collectionView.reloadData()
                self?.updateActionButtonsState()
            }
        }
        return cell
    }
}

// MARK: - UICollectionViewDelegateFlowLayout
extension BugReportingViewController: UICollectionViewDelegateFlowLayout {
    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, sizeForItemAt indexPath: IndexPath) -> CGSize {
        return CGSize(width: 100, height: 140)
    }
}

// MARK: - UIImagePickerControllerDelegate
extension BugReportingViewController: UIImagePickerControllerDelegate {
    func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        if let image = info[.editedImage] as? UIImage ?? info[.originalImage] as? UIImage,
           let imageData = image.jpegData(compressionQuality: CGFloat(configProvider.screenshotCompressionQuality) / 100.0) {
            addAttachment(MsrAttachment(name: galleryImageName, type: .screenshot, size: Int64(imageData.count), id: idProvider.uuid(), bytes: imageData, path: nil))
        }
        picker.dismiss(animated: true)
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
    }
}

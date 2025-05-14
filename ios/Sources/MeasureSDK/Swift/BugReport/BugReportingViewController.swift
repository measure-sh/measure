//
//  BugReportingViewController.swift
//  Measure
//
//  Created by Adwin Ross on 05/05/25.
//

import UIKit

protocol BugReportingViewControllerDelegate: AnyObject {
    func bugReportingViewControllerDidDismiss(_ description: String?, attachments: [MsrAttachment]?)
    func bugReportingViewControllerDidRequestScreenshot(_ attachments: [MsrAttachment])
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

    private let imagesCollectionView: UICollectionView = {
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .horizontal
        layout.minimumLineSpacing = 12
        let collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.backgroundColor = .clear
        collectionView.showsHorizontalScrollIndicator = false
        return collectionView
    }()
    private var attachments: [MsrAttachment]

    private let screenshotButton = UIButton(type: .system)
    private let uploadButton = UIButton(type: .system)

    init(attachments: [MsrAttachment] = [], configProvider: ConfigProvider, bugReportConfig: BugReportConfig) {
        self.attachments = attachments
        self.configProvider = configProvider
        self.bugReportConfig = bugReportConfig
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
        setupActionButtons()
        setupConstraints()

        imagesCollectionView.reloadData()
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
        cancelButton.layer.cornerRadius = bugReportConfig.dimensions.cancelButtonCornerRadius
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
        sendButton.setTitleColor(bugReportConfig.colors.placeholder, for: .normal)
        sendButton.titleLabel?.font = bugReportConfig.fonts.button
        sendButton.translatesAutoresizingMaskIntoConstraints = false
        sendButton.addTarget(self, action: #selector(sentTapped), for: .touchUpInside)
        sendButton.isEnabled = false
        navBar.addSubview(sendButton)
    }

    @objc private func cancelTapped() {
        self.dismiss(animated: true) {
            guard let delegate = self.delegate else { return }
            delegate.bugReportingViewControllerDidDismiss(nil, attachments: nil)
        }
    }

    @objc private func sentTapped() {
        self.dismiss(animated: true) { [weak self] in
            // TODO: add checks
            guard let delegate = self?.delegate,
                  let text = self?.textView.text,
                  text.count > 3,
                  let attachment = self?.attachments else { return }
            delegate.bugReportingViewControllerDidDismiss(text, attachments: attachment)
        }
    }

    private func setupTextView() {
        textView.backgroundColor = .clear
        textView.textColor = bugReportConfig.colors.text
        textView.font = bugReportConfig.fonts.description
        textView.delegate = self
        textView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(textView)

        placeholderLabel.text = bugReportConfig.text.descriptionPlaceholder
        placeholderLabel.textColor = bugReportConfig.colors.placeholder
        placeholderLabel.font = bugReportConfig.fonts.description
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

    private func setupActionButtons() {
        screenshotButton.setTitle(bugReportConfig.text.screenshotButton, for: .normal)
        screenshotButton.setTitleColor(bugReportConfig.colors.text, for: .normal)
        screenshotButton.backgroundColor = bugReportConfig.colors.buttonBackground
        screenshotButton.layer.cornerRadius = bugReportConfig.dimensions.buttonCornerRadius
        screenshotButton.titleLabel?.font = bugReportConfig.fonts.button
        screenshotButton.translatesAutoresizingMaskIntoConstraints = false
        screenshotButton.addTarget(self, action: #selector(screenshotButtonTapped), for: .touchUpInside)
        screenshotButton.isEnabled = attachments.count < 5
        view.addSubview(screenshotButton)

        uploadButton.setTitle(bugReportConfig.text.uploadButton, for: .normal)
        uploadButton.setTitleColor(bugReportConfig.colors.text, for: .normal)
        uploadButton.backgroundColor = bugReportConfig.colors.buttonBackground
        uploadButton.layer.cornerRadius = bugReportConfig.dimensions.buttonCornerRadius
        uploadButton.titleLabel?.font = bugReportConfig.fonts.button
        uploadButton.translatesAutoresizingMaskIntoConstraints = false
        uploadButton.addTarget(self, action: #selector(uploadButtonTapped), for: .touchUpInside)
        uploadButton.isEnabled = attachments.count < 5
        view.addSubview(uploadButton)
    }

    @objc private func screenshotButtonTapped() {
        // Dismiss and notify delegate
        self.dismiss(animated: true) { [weak self] in
            guard let self = self else { return }
            self.delegate?.bugReportingViewControllerDidRequestScreenshot(self.attachments)
        }
    }

    @objc private func uploadButtonTapped() {
        let imagePicker = UIImagePickerController()
        imagePicker.delegate = self
        imagePicker.sourceType = .photoLibrary
        imagePicker.allowsEditing = true
        present(imagePicker, animated: true)
    }

    private func setupConstraints() {
        let safe = view.safeAreaLayoutGuide

        NSLayoutConstraint.activate([
            // NavBar
            navBar.topAnchor.constraint(equalTo: safe.topAnchor),
            navBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            navBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            navBar.heightAnchor.constraint(equalToConstant: bugReportConfig.dimensions.navBarHeight),

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
            textView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            textView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            textView.heightAnchor.constraint(equalToConstant: 120),

            placeholderLabel.leadingAnchor.constraint(equalTo: textView.leadingAnchor, constant: 5),
            placeholderLabel.topAnchor.constraint(equalTo: textView.topAnchor, constant: 8),

            // Images CollectionView
            imagesCollectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            imagesCollectionView.topAnchor.constraint(equalTo: textView.bottomAnchor, constant: 16),
            imagesCollectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            imagesCollectionView.heightAnchor.constraint(equalToConstant: 140),

            // Action buttons
            screenshotButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            screenshotButton.topAnchor.constraint(equalTo: imagesCollectionView.bottomAnchor, constant: 16),
            screenshotButton.widthAnchor.constraint(equalToConstant: 160),
            screenshotButton.heightAnchor.constraint(equalToConstant: 44),

            uploadButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            uploadButton.topAnchor.constraint(equalTo: imagesCollectionView.bottomAnchor, constant: 16),
            uploadButton.widthAnchor.constraint(equalToConstant: 160),
            uploadButton.heightAnchor.constraint(equalToConstant: 44)
        ])
    }

    func addAttachment(_ attachment: MsrAttachment) {
        guard attachments.count < 5 else { return }
        attachments.append(attachment)
        imagesCollectionView.reloadData()
        updateActionButtonsState()
    }

    private func updateActionButtonsState() {
        let isEnabled = attachments.count < 5
        screenshotButton.isEnabled = isEnabled
        uploadButton.isEnabled = isEnabled

        let buttonColor = isEnabled ? bugReportConfig.colors.text : bugReportConfig.colors.placeholder

        screenshotButton.setTitleColor(buttonColor, for: .normal)
        uploadButton.setTitleColor(buttonColor, for: .normal)
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
        if let image = UIImage(data: attachments[indexPath.item].bytes) {
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
            addAttachment(MsrAttachment(name: galleryImageName, bytes: imageData, type: .screenshot))
        }
        picker.dismiss(animated: true)
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
    }
}

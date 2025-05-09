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

class BugReportingViewController: UIViewController,
                                  UITextViewDelegate,
                                  UICollectionViewDataSource,
                                  UICollectionViewDelegateFlowLayout,
                                  UIImagePickerControllerDelegate,
                                  UINavigationControllerDelegate {

    weak var delegate: BugReportingViewControllerDelegate?
    private let navBar = UIView()
    private let cancelButton = UIButton(type: .system)
    private let titleLabel = UILabel()
    private let sendButton = UIButton(type: .system)

    private let textView = UITextView()
    private let placeholderLabel = UILabel()
    private let configProvider: ConfigProvider

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

    init(attachments: [MsrAttachment] = [], configProvider: ConfigProvider) {
        self.attachments = attachments
        self.configProvider = configProvider
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        setupNavBar()
        setupTextView()
        setupImagesCollectionView()
        setupActionButtons()
        setupConstraints()

        imagesCollectionView.reloadData()
    }

    private func setupNavBar() {
        navBar.backgroundColor = .black
        navBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(navBar)

        // Cancel button with cross icon
        if #available(iOS 13.0, *) {
            cancelButton.setImage(UIImage(systemName: "xmark"), for: .normal)
        }
        cancelButton.setTitle(nil, for: .normal)
        cancelButton.tintColor = .white
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        navBar.addSubview(cancelButton)

        // Title
        titleLabel.text = "Report technical problem"
        titleLabel.textColor = .white
        titleLabel.font = UIFont.boldSystemFont(ofSize: 18)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        navBar.addSubview(titleLabel)

        // Send button
        sendButton.setTitle("Send", for: .normal)
        sendButton.setTitleColor(.gray, for: .normal)
        sendButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
        sendButton.translatesAutoresizingMaskIntoConstraints = false
        sendButton.addTarget(self, action: #selector(sentTapped), for: .touchUpInside)
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
        textView.textColor = .white
        textView.font = UIFont.systemFont(ofSize: 16)
        textView.delegate = self
        textView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(textView)

        placeholderLabel.text = "Briefly explain what happened or what isn't working."
        placeholderLabel.textColor = .gray
        placeholderLabel.font = UIFont.systemFont(ofSize: 16)
        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(placeholderLabel)
    }

    private func setupImagesCollectionView() {
        imagesCollectionView.delegate = self
        imagesCollectionView.dataSource = self
        imagesCollectionView.register(ImageCell.self, forCellWithReuseIdentifier: "ImageCell")
        imagesCollectionView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(imagesCollectionView)
    }

    private func setupActionButtons() {
        screenshotButton.setTitle("Screenshot", for: .normal)
        screenshotButton.setTitleColor(.white, for: .normal)
        screenshotButton.backgroundColor = UIColor(white: 0.15, alpha: 1)
        screenshotButton.layer.cornerRadius = 12
        screenshotButton.translatesAutoresizingMaskIntoConstraints = false
        screenshotButton.addTarget(self, action: #selector(screenshotButtonTapped), for: .touchUpInside)
        view.addSubview(screenshotButton)

        uploadButton.setTitle("Upload", for: .normal)
        uploadButton.setTitleColor(.white, for: .normal)
        uploadButton.backgroundColor = UIColor(white: 0.15, alpha: 1)
        uploadButton.layer.cornerRadius = 12
        uploadButton.translatesAutoresizingMaskIntoConstraints = false
        uploadButton.addTarget(self, action: #selector(uploadButtonTapped), for: .touchUpInside)
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

    // MARK: - UICollectionViewDataSource
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        return attachments.count
    }

    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "ImageCell", for: indexPath) as! ImageCell
        if let image = UIImage(data: attachments[indexPath.item].bytes) {
            cell.configure(with: image)
            cell.onDelete = { [weak self] in
                self?.attachments.remove(at: indexPath.item)
                collectionView.reloadData()
            }
        }
        return cell
    }

    // MARK: - UICollectionViewDelegateFlowLayout
    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, sizeForItemAt indexPath: IndexPath) -> CGSize {
        return CGSize(width: 100, height: 140)
    }

    // MARK: - UITextViewDelegate
    func textViewDidChange(_ textView: UITextView) {
        placeholderLabel.isHidden = !textView.text.isEmpty
    }

    // MARK: - Public Methods
    func addAttachment(_ attachment: MsrAttachment) {
        attachments.append(attachment)
        imagesCollectionView.reloadData()
    }

    // MARK: - UIImagePickerControllerDelegate
    func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        if let image = info[.editedImage] as? UIImage ?? info[.originalImage] as? UIImage, let imageData = image.jpegData(compressionQuality: CGFloat(configProvider.screenshotCompressionQuality/100)) {
            addAttachment(MsrAttachment(name: galleryImageName, bytes: imageData, type: .screenshot))
        }
        picker.dismiss(animated: true)
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
    }
}

class ImageCell: UICollectionViewCell {
    private let containerView = UIView()
    private let screenshotImageView = UIImageView()
    private let deleteButton = UIButton(type: .system)
    var onDelete: (() -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupViews() {
        backgroundColor = .clear

        containerView.backgroundColor = .black
        containerView.layer.cornerRadius = 8
        containerView.layer.borderWidth = 1
        containerView.layer.borderColor = UIColor.gray.cgColor
        containerView.clipsToBounds = true
        containerView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(containerView)

        screenshotImageView.contentMode = .scaleAspectFit
        screenshotImageView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(screenshotImageView)

        if #available(iOS 13.0, *) {
            deleteButton.setImage(UIImage(systemName: "xmark.circle.fill"), for: .normal)
        }
        deleteButton.tintColor = .white
        deleteButton.backgroundColor = UIColor(white: 0, alpha: 0.5)
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

    func configure(with image: UIImage) {
        screenshotImageView.image = image
    }

    @objc private func deleteButtonTapped() {
        onDelete?()
    }
}

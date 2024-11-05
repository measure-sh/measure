//
//  CollectionViewController.swift
//  MeasureDemo
//
//  Created by Adwin Ross on 03/10/24.
//

import UIKit

class CollectionViewController: UIViewController {
    enum Section: Int, CaseIterable {
        case horizontal, vertical
    }

    private var collectionView: UICollectionView!
    private var dataSource: UICollectionViewDiffableDataSource<Section, String>!

    let colors: [UIColor] = [.systemRed, .systemBlue, .systemGreen, .systemOrange, .systemPurple, .systemPink]

    override func viewDidLoad() {
        super.viewDidLoad()

        setupCollectionView()
        configureDataSource()
        applyInitialSnapshots()
    }

    private func setupCollectionView() {
        collectionView = UICollectionView(frame: view.bounds, collectionViewLayout: createLayout())
        collectionView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        collectionView.backgroundColor = .systemBackground

        collectionView.register(HorizontalCell.self, forCellWithReuseIdentifier: HorizontalCell.reuseIdentifier)
        collectionView.register(VerticalCell.self, forCellWithReuseIdentifier: VerticalCell.reuseIdentifier)

        view.addSubview(collectionView)
    }

    private func createLayout() -> UICollectionViewLayout {
        let layout = UICollectionViewCompositionalLayout { (sectionIndex, _) -> NSCollectionLayoutSection? in
            guard let section = Section(rawValue: sectionIndex) else { return nil }

            switch section {
            case .horizontal:
                return self.createHorizontalSection()
            case .vertical:
                return self.createVerticalSection()
            }
        }
        return layout
    }

    private func createHorizontalSection() -> NSCollectionLayoutSection {
        let itemSize = NSCollectionLayoutSize(widthDimension: .fractionalWidth(1.0), heightDimension: .fractionalHeight(1.0))
        let item = NSCollectionLayoutItem(layoutSize: itemSize)

        let groupSize = NSCollectionLayoutSize(widthDimension: .fractionalWidth(0.4), heightDimension: .absolute(150))
        let group = NSCollectionLayoutGroup.horizontal(layoutSize: groupSize, subitems: [item])

        let section = NSCollectionLayoutSection(group: group)
        section.orthogonalScrollingBehavior = .continuous
        section.interGroupSpacing = 10
        section.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10)

        return section
    }

    private func createVerticalSection() -> NSCollectionLayoutSection {
        let itemSize = NSCollectionLayoutSize(widthDimension: .fractionalWidth(1.0), heightDimension: .estimated(100))
        let item = NSCollectionLayoutItem(layoutSize: itemSize)

        let groupSize = NSCollectionLayoutSize(widthDimension: .fractionalWidth(1.0), heightDimension: .estimated(100))
        let group = NSCollectionLayoutGroup.vertical(layoutSize: groupSize, subitems: [item])

        let section = NSCollectionLayoutSection(group: group)
        section.interGroupSpacing = 10
        section.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10)

        return section
    }

    private func configureDataSource() {
        dataSource = UICollectionViewDiffableDataSource<Section, String>(collectionView: collectionView) { (collectionView, indexPath, item) -> UICollectionViewCell? in
            let section = Section(rawValue: indexPath.section)!
            switch section {
            case .horizontal:
                if let cell = collectionView.dequeueReusableCell(withReuseIdentifier: HorizontalCell.reuseIdentifier, for: indexPath) as? HorizontalCell {
                    cell.configure(with: item, color: self.colors.randomElement()!)
                    return cell
                }
            case .vertical:
                if let cell = collectionView.dequeueReusableCell(withReuseIdentifier: VerticalCell.reuseIdentifier, for: indexPath) as? VerticalCell {
                    cell.configure(with: item, color: self.colors.randomElement()!)
                    return cell
                }
            }
            return UICollectionViewCell()
        }
    }

    private func applyInitialSnapshots() {
        let horizontalItems = (1...10).map { "Horizontal Item \($0)" }
        let verticalItems = (1...20).map { "Vertical Item \($0)" }

        var snapshot = NSDiffableDataSourceSnapshot<Section, String>()
        snapshot.appendSections([.horizontal, .vertical])
        snapshot.appendItems(horizontalItems, toSection: .horizontal)
        snapshot.appendItems(verticalItems, toSection: .vertical)

        dataSource.apply(snapshot, animatingDifferences: false)
    }
}

// MARK: - HorizontalCell

class HorizontalCell: UICollectionViewCell {
    static let reuseIdentifier = "HorizontalCell"

    private let imageView = UIImageView()
    private let label = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupViews() {
        imageView.contentMode = .scaleAspectFit
        imageView.tintColor = .label
        contentView.addSubview(imageView)

        label.textAlignment = .center
        label.font = UIFont.preferredFont(forTextStyle: .caption1)
        label.numberOfLines = 0
        contentView.addSubview(label)

        imageView.translatesAutoresizingMaskIntoConstraints = false
        label.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            imageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
            imageView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),
            imageView.heightAnchor.constraint(equalTo: contentView.heightAnchor, multiplier: 0.6) // 60% of the cell height for the image
        ])

        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: imageView.bottomAnchor, constant: 8),
            label.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
            label.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),
            label.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8)
        ])

        // Apply styling to the contentView
        contentView.layer.cornerRadius = 10
        contentView.clipsToBounds = true
    }

    func configure(with title: String, color: UIColor) {
        label.text = title
        imageView.image = UIImage(systemName: "star.circle.fill")
        contentView.backgroundColor = color.withAlphaComponent(0.2)
    }
}

// MARK: - VerticalCell

class VerticalCell: UICollectionViewCell {
    static let reuseIdentifier = "VerticalCell"

    private let imageView = UIImageView()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupViews() {
        imageView.contentMode = .scaleAspectFit
        imageView.tintColor = .label
        imageView.translatesAutoresizingMaskIntoConstraints = false

        titleLabel.font = UIFont.preferredFont(forTextStyle: .headline)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        subtitleLabel.font = UIFont.preferredFont(forTextStyle: .subheadline)
        subtitleLabel.textColor = .secondaryLabel
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        contentView.addSubview(imageView)
        contentView.addSubview(titleLabel)
        contentView.addSubview(subtitleLabel)

        NSLayoutConstraint.activate([
            // ImageView constraints
            imageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 12),
            imageView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            imageView.widthAnchor.constraint(equalToConstant: 40),
            imageView.heightAnchor.constraint(equalToConstant: 40),

            // TitleLabel constraints
            titleLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 12),
            titleLabel.leadingAnchor.constraint(equalTo: imageView.trailingAnchor, constant: 12),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -12),

            // SubtitleLabel constraints
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            subtitleLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -12)
        ])

        contentView.layer.cornerRadius = 10
        contentView.clipsToBounds = true
    }

    func configure(with title: String, color: UIColor) {
        titleLabel.text = title
        subtitleLabel.text = "Some dummy text here"
        imageView.image = UIImage(systemName: "square.and.arrow.up.circle.fill")
        contentView.backgroundColor = color.withAlphaComponent(0.2)
    }
}

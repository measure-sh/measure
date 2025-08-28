//
//  ControlsViewController.swift
//  MeasureDemo
//
//  Created by Adwin Ross on 05/10/24.
//

import UIKit
import Measure

class ControlsViewController: UIViewController {
    @IBOutlet weak var segmentControl: UISegmentedControl!

    override func viewDidLoad() {
        super.viewDidLoad()

        // Add target for UISegmentedControl when value changes
        segmentControl.addTarget(self, action: #selector(segmentControlValueChanged(_:)), for: .valueChanged)
        Measure.stop()
    }

    // Show alert when UISegmentedControl value changes
    @objc private func segmentControlValueChanged(_ sender: UISegmentedControl) {
        let selectedIndex = sender.selectedSegmentIndex
        let selectedSegmentTitle = sender.titleForSegment(at: selectedIndex) ?? "Unknown"

        // Show alert when segment control is clicked
        showAlert(
            title: "Segment Selected",
            description: "You selected segment: \(selectedSegmentTitle)",
            successButtonTitle: "OK",
            failureButtonTitle: "Cancel"
        )
    }

    private func showAlert(title: String, description: String, successButtonTitle: String, failureButtonTitle: String) {
        let alertController = UIAlertController(title: title, message: description, preferredStyle: .alert)
        let successAction = UIAlertAction(title: successButtonTitle, style: .default) { _ in
            // Handle success action
            print("\(successButtonTitle) button tapped")
        }
        let failureAction = UIAlertAction(title: failureButtonTitle, style: .cancel) { _ in
            // Handle failure action
            print("\(failureButtonTitle) button tapped")
        }

        alertController.addAction(successAction)
        alertController.addAction(failureAction)

        if let popover = alertController.popoverPresentationController {
            popover.sourceView = self.view
            popover.sourceRect = CGRect(x: self.view.bounds.midX,
                                        y: self.view.bounds.midY,
                                        width: 0, height: 0)
            popover.permittedArrowDirections = []
        }

        present(alertController, animated: true, completion: nil)
    }

    private func showPicker(_ data: [String]) {
        let alertController = UIAlertController(title: "Select an Option", message: nil, preferredStyle: .actionSheet)

        for option in data {
            let action = UIAlertAction(title: option, style: .default) { _ in
                print("Selected option: \(option)")
            }
            alertController.addAction(action)
        }

        let cancelAction = UIAlertAction(title: "Cancel", style: .cancel, handler: nil)
        alertController.addAction(cancelAction)

        if let popover = alertController.popoverPresentationController {
            popover.sourceView = self.view
            popover.sourceRect = CGRect(x: self.view.bounds.midX,
                                        y: self.view.bounds.midY,
                                        width: 0, height: 0)
            popover.permittedArrowDirections = []
        }

        present(alertController, animated: true, completion: nil)
    }

    private func showDatePicker() {
        let datePicker = UIDatePicker()
        datePicker.datePickerMode = .date

        let alertController = UIAlertController(title: "Select a Date", message: nil, preferredStyle: .alert)

        alertController.view.addSubview(datePicker)

        datePicker.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            datePicker.leadingAnchor.constraint(equalTo: alertController.view.leadingAnchor, constant: 10),
            datePicker.trailingAnchor.constraint(equalTo: alertController.view.trailingAnchor, constant: -10),
            datePicker.topAnchor.constraint(equalTo: alertController.view.topAnchor, constant: 50),
            datePicker.bottomAnchor.constraint(equalTo: alertController.view.bottomAnchor, constant: -50)
        ])

        let selectAction = UIAlertAction(title: "Select", style: .default) { _ in
            let selectedDate = datePicker.date
            print("Selected date: \(selectedDate)")
        }
        alertController.addAction(selectAction)

        let cancelAction = UIAlertAction(title: "Cancel", style: .cancel, handler: nil)
        alertController.addAction(cancelAction)

        present(alertController, animated: true, completion: nil)
    }

    @IBAction func switchAction(_ sender: UISwitch) {
        showAlert(title: "Switch Toggled", description: "Switch is now \(sender.isOn ? "ON" : "OFF")", successButtonTitle: "OK", failureButtonTitle: "Cancel")
    }

    @IBAction func showPickerAction(_ sender: UIButton) {
        showPicker(["1", "2", "3", "4", "5"])
    }

    @IBAction func showDatePickerAction(_ sender: UIButton) {
        showDatePicker()
    }
}

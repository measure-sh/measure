import SwiftUI
import Shared

struct ContentView: View {
    var body: some View {
        NavigationStack {
            List {
                Button("Tap") { }
                Button("Crash platform") {
                    // fatalError("Artificial crash from iOS platform")
                    let array = [1,2]
                    let v = array[5]
                }
                Button("Crash shared") {
                    CrashHelperKt.triggerSharedCrash()
                }
            }
            .navigationTitle("Measure")
        }
    }
}

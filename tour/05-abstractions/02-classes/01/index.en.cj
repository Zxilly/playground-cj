class Counter {
    var count: Int64
    var label: String

    // Constructor must initialize all member variables
    init(count: Int64, label: String) {
        this.count = count
        this.label = label
    }

    // Member function
    public func increment() {
        count += 1
    }

    public func describe(): String {
        "${label}: ${count}"
    }
}

main() {
    // Create instance
    let counter = Counter(0, "Clicks")
    println(counter.describe())

    // Call member function
    counter.increment()
    counter.increment()
    println("After increment: ${counter.describe()}")

    // Reference type behavior: assignment does not copy data
    let sameCounter = counter
    sameCounter.label = "Visits"
    sameCounter.count = 100
    println("Original variable: ${counter.describe()}")
    println("New variable: ${sameCounter.describe()}")
}
// Define flying interface
interface Flyable {
    func fly(): String
    func altitude(): Int64
}

// Bird class
class Bird <: Flyable {
    let name: String

    init(name: String) {
        this.name = name
    }

    public func fly(): String {
        "${name} spreads its wings and flies high"
    }

    public func altitude(): Int64 {
        100  // Bird flight altitude
    }
}

// Airplane class
class Airplane <: Flyable {
    let model: String

    init(model: String) {
        this.model = model
    }

    public func fly(): String {
        "${model} takes off and cruises"
    }

    public func altitude(): Int64 {
        10000  // Airplane cruising altitude
    }
}

// Unified launch function, accepts any Flyable
func launch(item: Flyable) {
    println("Launch: ${item.fly()}")
    println("Altitude: ${item.altitude()} meters")
}

// Compare flight altitudes
func compareAltitude(a: Flyable, b: Flyable) {
    let ha = a.altitude()
    let hb = b.altitude()
    if (ha > hb) {
        println("The first flying object is higher")
    } else if (ha < hb) {
        println("The second flying object is higher")
    } else {
        println("Both are at the same altitude")
    }
}

main() {
    let bird = Bird("Eagle")
    let plane = Airplane("Boeing 747")

    println("=== Polymorphism Demo ===")
    launch(bird)
    println()
    launch(plane)

    println("\n=== Altitude Comparison ===")
    compareAltitude(bird, plane)
}
// Define Runner interface
interface Runner {
    func run(): String
}

// Dog implements the interface
class Dog <: Runner {
    public func run(): String {
        "The dog runs happily"
    }
}

// Athlete implements the interface
class Athlete <: Runner {
    public func run(): String {
        "The athlete runs quickly"
    }
}

// Function that accepts any Runner interface type
func showRun(item: Runner) {
    let result = item.run()
    println("Action: ${result}")
}

// Check who runs faster
func race(r1: Runner, r2: Runner) {
    println("Race begins!")
    println("Runner 1: ${r1.run()}")
    println("Runner 2: ${r2.run()}")
}

main() {
    let dog = Dog()
    let athlete = Athlete()

    println("=== Polymorphism Demo ===")
    showRun(dog)      // Pass in Dog
    showRun(athlete)  // Pass in Athlete

    println("\n=== Race ===")
    race(dog, athlete)

    // Array of interface type
    let runners: Array<Runner> = [dog, athlete]
    println("\n=== Group Training ===")
    for (r in runners) {
        println("- ${r.run()}")
    }
}
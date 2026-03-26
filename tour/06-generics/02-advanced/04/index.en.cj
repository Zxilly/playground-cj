// Define displayable interface
interface Displayable {
    func display(): String
}

// Define comparable interface
interface Comparable<T> {
    func compareTo(other: T): Int64
}

// Score class implements both interfaces
class Score <: Displayable & Comparable<Score> {
    let value: Int64
    let subject: String

    init(subject: String, value: Int64) {
        this.subject = subject
        this.value = value
    }

    // Implement Displayable interface
    public func display(): String {
        "${subject}: ${value} points"
    }

    // Implement Comparable interface
    public func compareTo(other: Score): Int64 {
        this.value - other.value
    }
}

// Single-constraint generic function: only needs Comparable
// Returns the larger value
func findMax<T>(a: T, b: T): T where T <: Comparable<T> {
    if (a.compareTo(b) > 0) {
        a
    } else {
        b
    }
}

// Double-constraint generic function: needs Comparable and Displayable
// Find maximum value and display
func showMax<T>(a: T, b: T): Unit where T <: Comparable<T> & Displayable {
    let max = findMax(a, b)  // Call single-constraint function
    println("Highest score: ${max.display()}")
}

// Triple constraint example: comparable, displayable, and countable
interface Countable {
    func count(): Int64
}

func process<T>(a: T, b: T): Unit where T <: Comparable<T> & Displayable & Countable {
    println("Processing two items...")
    println("Item A: ${a.display()}")
    println("Item B: ${b.display()}")
    
    let max = findMax(a, b)
    println("Larger one: ${max.display()}")
}

main() {
    let math1 = Score("Math", 85)
    let math2 = Score("Math", 92)

    println("Comparing two math scores:")
    showMax(math1, math2)

    let english1 = Score("English", 78)
    let english2 = Score("English", 95)

    println("\nComparing two English scores:")
    showMax(english1, english2)
}
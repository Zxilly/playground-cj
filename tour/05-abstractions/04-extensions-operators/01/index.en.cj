// Add utility functions to Int64
extend Int64 {
    // Check if the number is even
    func isEven(): Bool {
        return this % 2 == 0
    }

    // Check if the number is positive
    func isPositive(): Bool {
        return this > 0
    }

    // Calculate absolute value
    func abs(): Int64 {
        if (this < 0) {
            return -this
        }
        return this
    }

    // Check if within specified range
    func inRange(low: Int64, high: Int64): Bool {
        return this >= low && this <= high
    }
}

main() {
    let numbers = [42, -7, 0, 15, -100]
    
    for (n in numbers) {
        println("Number ${n}:")
        println("  Is even: ${n.isEven()}")
        println("  Is positive: ${n.isPositive()}")
        println("  Absolute value: ${n.abs()}")
        println("  In range 0-50: ${n.inRange(0, 50)}")
        println()
    }
}
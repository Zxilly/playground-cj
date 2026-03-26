struct Temperature {
    public let celsius: Float64

    public init(celsius: Float64) {
        this.celsius = celsius
    }

    // Overload equality operator
    public operator func ==(rhs: Temperature): Bool {
        return this.celsius == rhs.celsius
    }

    // Overload inequality operator
    public operator func !=(rhs: Temperature): Bool {
        return this.celsius != rhs.celsius
    }

    // Overload less than operator
    public operator func <(rhs: Temperature): Bool {
        return this.celsius < rhs.celsius
    }

    // Overload greater than operator
    public operator func >(rhs: Temperature): Bool {
        return this.celsius > rhs.celsius
    }

    // Overload less than or equal operator
    public operator func <=(rhs: Temperature): Bool {
        return this.celsius <= rhs.celsius
    }

    // Overload greater than or equal operator
    public operator func >=(rhs: Temperature): Bool {
        return this.celsius >= rhs.celsius
    }

    // Format output
    public func toString(): String {
        return "${this.celsius}°C"
    }
}

main() {
    let boiling = Temperature(100.0)    // Boiling point
    let freezing = Temperature(0.0)     // Freezing point
    let body = Temperature(37.0)        // Body temperature
    let another = Temperature(37.0)     // Another body temperature

    println("Boiling point: ${boiling.toString()}")
    println("Freezing point: ${freezing.toString()}")
    println("Body temperature: ${body.toString()}")
    println()

    // Use overloaded comparison operators
    println("Boiling > Freezing: ${boiling > freezing}")
    println("Freezing < Body temp: ${freezing < body}")
    println("Body temp == Another: ${body == another}")
    println("Boiling != Freezing: ${boiling != freezing}")
    println("Body temp <= Boiling: ${body <= boiling}")
    println("Freezing >= Boiling: ${freezing >= boiling}")
    println()

    // Find highest temperature
    let temps = [freezing, body, boiling]
    var maxTemp = temps[0]
    for (t in temps) {
        if (t > maxTemp) {
            maxTemp = t
        }
    }
    println("Highest temperature: ${maxTemp.toString()}")
}
struct Temperature {
    let celsius: Float64

    public init(celsius: Float64) {
        this.celsius = celsius
    }

    operator func ==(rhs: Temperature): Bool {
        return this.celsius == rhs.celsius
    }

    operator func !=(rhs: Temperature): Bool {
        return this.celsius != rhs.celsius
    }

    operator func <(rhs: Temperature): Bool {
        return this.celsius < rhs.celsius
    }

    operator func >(rhs: Temperature): Bool {
        return this.celsius > rhs.celsius
    }

    operator func <=(rhs: Temperature): Bool {
        return this.celsius <= rhs.celsius
    }

    operator func >=(rhs: Temperature): Bool {
        return this.celsius >= rhs.celsius
    }

    func toString(): String {
        return "${this.celsius}°C"
    }
}

main() {
    let boiling = Temperature(100.0)
    let freezing = Temperature(0.0)
    let body = Temperature(37.0)
    let another = Temperature(37.0)

    println("Boiling: ${boiling.toString()}")
    println("Freezing: ${freezing.toString()}")
    println("Body: ${body.toString()}")

    println("boiling > freezing: ${boiling > freezing}")
    println("freezing < body: ${freezing < body}")
    println("body == another: ${body == another}")
    println("boiling != freezing: ${boiling != freezing}")
}
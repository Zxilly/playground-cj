class Temperature {
    // Actually stored field
    var celsius: Float64

    init(celsius: Float64) {
        this.celsius = celsius
    }

    // Read-only computed property: Fahrenheit temperature
    public prop fahrenheit: Float64 {
        get() {
            celsius * 9.0 / 5.0 + 32.0
        }
    }

    // Read-only computed property: temperature description
    public prop description: String {
        get() {
            "${celsius}°C / ${fahrenheit}°F"
        }
    }

    // Mutable property: temperature level
    public mut prop level: String {
        get() {
            if (celsius < 0.0) {
                "Freezing"
            } else if (celsius < 20.0) {
                "Cool"
            } else if (celsius < 30.0) {
                "Warm"
            } else {
                "Hot"
            }
        }
        set(v) {
            // Reverse set Celsius based on level (simplified)
            if (v == "Freezing") {
                celsius = -10.0
            } else if (v == "Cool") {
                celsius = 15.0
            } else if (v == "Warm") {
                celsius = 25.0
            } else if (v == "Hot") {
                celsius = 35.0
            }
        }
    }
}

main() {
    let temp = Temperature(25.0)
    println("Initial temperature: ${temp.description}")
    println("Temperature level: ${temp.level}")

    // Modify stored field, computed property updates automatically
    temp.celsius = 0.0
    println("Freezing point of water: ${temp.description}")
    println("Temperature level: ${temp.level}")

    temp.celsius = 100.0
    println("Boiling point of water: ${temp.description}")
    println("Temperature level: ${temp.level}")

    // Modify via property
    temp.level = "Cool"
    println("Set to cool: ${temp.description}")
}
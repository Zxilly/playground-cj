class Temperature {
    var celsius: Float64

    init(celsius: Float64) {
        this.celsius = celsius
    }

    // Read-only computed property
    prop fahrenheit: Float64 {
        get() {
            celsius * 9.0 / 5.0 + 32.0
        }
    }

    prop description: String {
        get() {
            "${celsius}C / ${fahrenheit}F"
        }
    }
}

main() {
    let temp = Temperature(100.0)
    println("Celsius: ${temp.celsius}")
    println("Fahrenheit: ${temp.fahrenheit}")
    println(temp.description)

    temp.celsius = 0.0
    println("After change: ${temp.description}")

    temp.celsius = 37.0
    println("Body temp: ${temp.description}")
}
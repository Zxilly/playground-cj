main() {
    // if expression returns value assigned to variable
    let temperature = 28
    let weather = if (temperature > 30) {
        "Hot"
    } else if (temperature > 20) {
        "Warm"
    } else {
        "Cool"
    }
    println("Temperature ${temperature}°C: ${weather}")

    // Used to calculate absolute value
    let x = -15
    let abs = if (x >= 0) { x } else { -x }
    println("Absolute value of ${x} is ${abs}")

    // Used to find the larger of two numbers
    let a = 10
    let b = 20
    let max = if (a > b) { a } else { b }
    println("Larger of ${a} and ${b} is ${max}")

    // Used for conditional assignment
    let score = 75
    let status = if (score >= 60) { "Pass" } else { "Fail" }
    println("Score ${score}: ${status}")
}
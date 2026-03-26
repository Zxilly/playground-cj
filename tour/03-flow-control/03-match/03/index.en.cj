main() {
    let code = 404

    // Binding pattern: capture the matched value
    match (code) {
        case 200 => println("Request successful")
        case 301 => println("Permanent redirect")
        case 404 => println("Resource not found")
        case other => println("Received status code: ${other}")  // Binds any other value
    }

    // Binding pattern can return results using the value
    let score = 75
    let result = match (score) {
        case 100 => "Perfect score!"
        case 0 => "Zero score"
        case n => "Score: ${n}"  // Use the bound value
    }
    println(result)

    // Binding pattern is useful for handling remaining cases
    let count = 3
    match (count) {
        case 0 => println("No items")
        case 1 => println("One item")
        case n => println("${n} items")  // Bind and display
    }
}
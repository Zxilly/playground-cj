func processData(data: String): Unit {
    println("Opening resource...")
    try {
        println("Processing: ${data}")
        if (data.isEmpty()) {
            throw Exception("Empty data")
        }
        println("Processing complete")
    } catch (e: Exception) {
        println("Error: ${e.message}")
    } finally {
        println("Closing resource (always runs)")
    }
}

func riskyOperation(): Int64 {
    try {
        println("Starting risky operation")
        throw Exception("Something failed")
        return 1
    } catch (e: Exception) {
        println("Caught: ${e.message}")
        return -1
    } finally {
        println("Finally block runs even with return")
    }
}

main() {
    println("=== Normal case ===")
    processData("hello")

    println("")
    println("=== Error case ===")
    processData("")

    println("")
    println("=== Return with finally ===")
    let result = riskyOperation()
    println("Result: ${result}")
}

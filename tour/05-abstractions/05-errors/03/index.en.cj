func processFile(filename: String): Unit {
    println("Opening file: ${filename}")
    try {
        if (filename.isEmpty()) {
            throw Exception("Filename cannot be empty")
        }
        println("Processing file content...")
    } catch (e: Exception) {
        println("Processing failed: ${e.message}")
    } finally {
        // Always executes, whether successful or failed
        println("Closing file: ${filename}")
    }
}

func riskyOperation(): Int64 {
    try {
        println("Starting risky operation")
        throw Exception("Operation failed")
        println("This line will not execute")
        return 1
    } catch (e: Exception) {
        println("Caught exception: ${e.message}")
        return -1  // Even with return here, finally executes first
    } finally {
        println("finally block always executes")
    }
}

main() {
    // Case 1: Normal execution
    println("=== Normal Case ===")
    processFile("data.txt")

    println("")

    // Case 2: Exception thrown
    println("=== Exception Case ===")
    processFile("")

    println("")

    // Case 3: Return in catch
    println("=== Case with Return Value ===")
    let result = riskyOperation()
    println("Return value: ${result}")
}
main() {
    // Unit type: println returns Unit
    let result: Unit = println("println's return value is Unit")
    println("Unit value: ${result}")
    
    // Unit's only value is ()
    let empty: Unit = ()
    println("Empty value: ${empty}")
    
    // Assignment expression type is also Unit
    var x = 10
    let assignResult = (x = 20)
    println("After assignment x = ${x}")
    println("Assignment expression result: ${assignResult}")

    // Nothing type for control flow
    // break, continue, return have type Nothing
    println("Starting loop")
    for (i in 0..5) {
        if (i == 3) {
            println("Encountered i=3, executing break")
            break  // break's type is Nothing
            // Code after break will not execute
            println("This line will not print")
        }
        println("i = ${i}")
    }
    println("Loop ended")

    // Nothing is a subtype of all types, enabling flexible type inference
    func assertPositive(n: Int64): Unit {
        if (n < 0) {
            throw IllegalArgumentException("n must be positive")
            // throw's type is Nothing, so function returns Unit
        }
        println("${n} is positive")
    }
    
    assertPositive(42)
}
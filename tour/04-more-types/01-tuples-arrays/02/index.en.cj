main() {
    // Create array literal
    let numbers: Array<Int64> = [10, 20, 30, 40, 50]
    println("First element: ${numbers[0]}")
    println("Last element: ${numbers[numbers.size - 1]}")
    println("Array length: ${numbers.size}")
    
    // Create using constructor
    let squares = Array<Int64>(5, { i: Int64 => (i + 1) * (i + 1) })
    println("Squares: ${squares}")
    
    // for-in iteration
    println("Iterating array:")
    for (n in numbers) {
        print("${n} ")
    }
    println("")
    
    // Modify element value
    numbers[1] = 25
    println("After modification numbers[1] = ${numbers[1]}")
    
    // Array is a reference type
    let ref = numbers
    ref[0] = 100
    println("After modifying via ref, numbers[0] = ${numbers[0]}")
    
    // String array
    let fruits = ["Apple", "Banana", "Orange"]
    println("Fruits:")
    for (fruit in fruits) {
        println("  - ${fruit}")
    }
}
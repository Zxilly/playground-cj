import std.collection.ArrayList
import std.math.sqrt

main(): Unit {
    // Use explicitly imported ArrayList
    let numbers = ArrayList<Int64>()
    numbers.add(10)
    numbers.add(20)
    numbers.add(30)
    numbers.add(40)
    
    println("Elements in the list:")
    for (num in numbers) {
        println("  ${num}")
    }
    
    // Use imported math function
    let value: Float64 = 16.0
    let root = sqrt(value)
    println("\nThe square root of ${value} is ${root}")
    
    // String, Int64 etc. are automatically available (from implicitly imported core package)
    let message: String = "Implicitly imported types don't need manual import"
    println("\n${message}")
}
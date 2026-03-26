import std.collection.ArrayList

main(): Int64 {
    // Create an empty ArrayList
    let numbers = ArrayList<Int64>()
    
    // Add elements at the end
    numbers.add(10)
    numbers.add(20)
    numbers.add(30)
    println("After adding: size = ${numbers.size}")
    
    // Insert element at a specific position
    numbers.add(25, at: 2)  // Insert 25 at index 2
    println("After inserting 25 at position 2:")
    for (i in 0..numbers.size) {
        println("  [${i}] = ${numbers[i]}")
    }
    
    // Modify element by index
    numbers[0] = 11
    println("After modifying [0] to 11: ${numbers[0]}")
    
    // Delete element at a specific position
    numbers.remove(at: 1)  // Delete element at index 1
    println("After deleting position 1: size = ${numbers.size}")
    
    // Iterate through all elements
    println("Final list:")
    for (number in numbers) {
        println("  ${number}")
    }
    
    return 0
}
import std.collection.*

main() {
    // Create an ArrayList
    let numbers = ArrayList<Int64>()

    // Append elements
    numbers.append(10)
    numbers.append(20)
    numbers.append(30)
    numbers.append(40)
    println("Numbers: ${numbers}")
    println("Size: ${numbers.size}")

    // Access by index
    println("First: ${numbers[0]}")
    println("Last: ${numbers[numbers.size - 1]}")

    // Modify by index
    numbers[1] = 25
    println("After update: ${numbers}")

    // Insert at position
    numbers.insert(2, 27)
    println("After insert: ${numbers}")

    // Remove element
    let removed = numbers.remove(0)
    println("Removed: ${removed}")
    println("After remove: ${numbers}")

    // Initialize with values
    let fruits = ArrayList<String>(["apple", "banana", "cherry"])
    println("Fruits: ${fruits}")
    println("Contains banana: ${fruits.contains("banana")}")
}
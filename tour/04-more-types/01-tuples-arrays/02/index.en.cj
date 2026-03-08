main() {
    // Array literal
    let numbers = [10, 20, 30, 40, 50]
    println("First: ${numbers[0]}")
    println("Last: ${numbers[numbers.size - 1]}")
    println("Size: ${numbers.size}")

    // Array with constructor
    let squares = Array<Int64>(5, { i: Int64 => (i + 1) * (i + 1) })
    println("Squares: ${squares}")

    // Iterating over an array
    print("Numbers: ")
    for (n in numbers) {
        print("${n} ")
    }
    println("")

    // String array
    let fruits = ["apple", "banana", "cherry"]
    for (f in fruits) {
        println("Fruit: ${f}")
    }
}

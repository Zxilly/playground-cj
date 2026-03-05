import std.collection.*

main() {
    let numbers = ArrayList<Int64>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    println("Original: ${numbers}")

    // map - transform each element
    let doubled = numbers.map { n: Int64 => n * 2 }
    println("Doubled: ${doubled}")

    let strings = numbers.map { n: Int64 => "No.${n}" }
    println("As strings: ${strings}")

    // filter - keep elements matching condition
    let evens = numbers.filter { n: Int64 => n % 2 == 0 }
    println("Evens: ${evens}")

    let big = numbers.filter { n: Int64 => n > 5 }
    println("Greater than 5: ${big}")

    // reduce - combine into single value
    let sum = numbers.reduce({ a: Int64, b: Int64 => a + b }, init: 0)
    println("Sum: ${sum}")

    let product = numbers.reduce({ a: Int64, b: Int64 => a * b }, init: 1)
    println("Product: ${product}")

    // Chaining operations
    let result = numbers
        .filter { n: Int64 => n % 2 == 0 }
        .map { n: Int64 => n * n }
    println("Even squares: ${result}")
}
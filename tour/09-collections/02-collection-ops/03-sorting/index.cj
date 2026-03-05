import std.collection.*
import std.sort.*

main() {
    // Sort an array
    var numbers = [5, 2, 8, 1, 9, 3, 7, 4, 6]
    println("Before sort: ${numbers}")
    sort(numbers)
    println("After sort: ${numbers}")

    // Sort in descending order
    var desc = [5, 2, 8, 1, 9, 3]
    sort(desc, stable: true) { a: Int64, b: Int64 => b - a > 0 }
    println("Descending: ${desc}")

    // Sort strings
    var names = ["Charlie", "Alice", "Bob", "Diana"]
    sort(names)
    println("Sorted names: ${names}")

    // Sort ArrayList
    let scores = ArrayList<Int64>([78, 95, 62, 88, 71])
    println("Scores: ${scores}")

    // Convert to array, sort, display
    var scoreArr = Array<Int64>(scores.size) { i: Int64 => scores[i] }
    sort(scoreArr)
    println("Sorted scores: ${scoreArr}")
}
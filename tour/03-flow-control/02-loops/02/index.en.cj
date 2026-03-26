main() {
    // Iterate over array
    let fruits = ["apple", "banana", "orange", "grape"]
    for (fruit in fruits) {
        println("Fruit: ${fruit}")
    }
    
    // Iterate over range and calculate sum
    var sum = 0
    for (i in 1..=5) {
        sum += i
    }
    println("Sum of 1 to 5: ${sum}")
    
    // Use where to filter odd numbers
    print("Odd numbers from 0 to 10: ")
    for (i in 0..10 where i % 2 == 1) {
        print("${i} ")
    }
    println("")
    
    // Use wildcard _ to ignore iteration variable
    var count = 0
    for (_ in 0..5) {
        count++
    }
    println("Loop executed ${count} times")
    
    // Iterate over array of tuples and destructure
    let points = [(0, 0), (3, 4), (6, 8)]
    println("Coordinate points:")
    for ((x, y) in points) {
        println("  (${x}, ${y})")
    }
}
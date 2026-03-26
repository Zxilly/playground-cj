import std.collection.ArrayList

main(): Int64 {
    let numbers = ArrayList<Int64>([1, 2, 3, 4, 5])
    println("Original list: ${numbers}")
    
    // Map: square each element
    let squares = ArrayList<Int64>()
    for (number in numbers) {
        squares.add(number * number)
    }
    println("\nAfter map (square): ${squares}")
    
    // Filter: keep only even numbers
    let evens = ArrayList<Int64>()
    for (number in numbers) {
        if (number % 2 == 0) {
            evens.add(number)
        }
    }
    println("After filter (even numbers): ${evens}")
    
    // Reduce: sum all elements
    var sum: Int64 = 0
    for (number in numbers) {
        sum += number
    }
    println("After reduce (sum): ${sum}")
    
    // Combination example: filter then map
    let evenSquares = ArrayList<Int64>()
    for (number in numbers) {
        if (number % 2 == 0) {
            evenSquares.add(number * number)
        }
    }
    println("\nFilter even numbers, then square: ${evenSquares}")
    
    // Combination example: map then filter
    let squaresOver5 = ArrayList<Int64>()
    for (number in numbers) {
        let sq = number * number
        if (sq > 5) {
            squaresOver5.add(sq)
        }
    }
    println("Square first, then filter > 5: ${squaresOver5}")
    
    return 0
}
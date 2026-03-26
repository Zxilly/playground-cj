main() {
    // break example: find the first number divisible by 7
    print("Finding first number divisible by 7: ")
    for (i in 1..100) {
        if (i % 7 == 0) {
            println("${i}")
            break  // exit loop immediately after finding
        }
    }
    
    // continue example: print odd numbers
    print("Odd numbers from 0 to 10: ")
    for (i in 0..10) {
        if (i % 2 == 0) {
            continue  // skip even numbers
        }
        print("${i} ")
    }
    println("")
    
    // Comprehensive example: find first 5 positive integers not divisible by 3
    var count = 0
    print("First 5 positive integers not divisible by 3: ")
    var n = 1
    while (true) {
        if (n % 3 == 0) {
            n++
            continue  // skip numbers divisible by 3
        }
        print("${n} ")
        count++
        n++
        if (count >= 5) {
            break  // exit after finding 5
        }
    }
    println("")
    
    // break and continue in nested loops
    println("Nested loop example (only print first 2 iterations of inner loop):")
    for (i in 1..=3) {
        print("Outer ${i}: ")
        var innerCount = 0
        for (j in 1..=5) {
            print("${j} ")
            innerCount++
            if (innerCount >= 2) {
                break  // only affects inner loop
            }
        }
        println("")
    }
}
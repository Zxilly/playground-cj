main() {
    // Half-open range: 0, 1, 2, 3, 4 (doesn't include 5)
    print("0..5: ")
    for (i in 0..5) {
        print("${i} ")
    }
    println("")
    
    // Closed range: 0, 1, 2, 3, 4, 5 (includes 5)
    print("0..=5: ")
    for (i in 0..=5) {
        print("${i} ")
    }
    println("")
    
    // Specify step
    print("0..10 with step 2: ")
    for (i in 0..10 : 2) {
        print("${i} ")
    }
    println("")
    
    // Decreasing range: negative step
    print("10..=0 with step -2: ")
    for (i in 10..=0 : -2) {
        print("${i} ")
    }
    println("")
    
    // Empty range: step direction contradicts range direction
    var count = 0
    for (_ in 10..0 : 1) {  // step is positive, but 10 > 0
        count++  // this line won't execute
    }
    println("Empty range loop body execution count: ${count}")
    
    // Application: calculate sum of 1 to 100
    var sum = 0
    for (i in 1..=100) {
        sum += i
    }
    println("Sum of 1 to 100: ${sum}")
}
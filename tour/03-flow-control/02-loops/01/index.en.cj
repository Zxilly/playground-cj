main() {
    // while loop: calculate the sum of 1 to 10
    var i = 1
    var sum = 0
    while (i <= 10) {
        sum += i
        i++
    }
    println("Sum of 1 to 10: ${sum}")
    
    // do-while loop: executes at least once
    var n = 100
    var count = 0
    do {
        println("do-while loop execution ${count + 1}")
        count++
    } while (n < 10)  // condition is false, but loop body still executes once
    
    // Typical application: divide by 2 until 0
    var num = 100
    var divisions = 0
    while (num > 0) {
        num /= 2
        divisions++
    }
    println("100 needs to be divided by 2 ${divisions} times to become 0")
}
main() {
    // Basic assignment
    var score = 10
    println("Initial score: ${score}")
    
    score = 12
    println("After reassignment: ${score}")
    
    // Compound assignment operators
    score += 5
    println("score += 5 => ${score}")
    
    score -= 3
    println("score -= 3 => ${score}")
    
    score *= 2
    println("score *= 2 => ${score}")
    
    score /= 2
    println("score /= 2 => ${score}")
    
    score %= 4
    println("score %= 4 => ${score}")
    
    // Exponentiation assignment
    var base = 2
    base **= 3
    println("\n2 **= 3 => ${base}")
    
    // Multi-assignment expression
    println("\nMulti-assignment expression:")
    var x = 10
    var y = 20
    println("Before swap: x = ${x}, y = ${y}")
    (x, y) = (y, x)
    println("After swap: x = ${x}, y = ${y}")
    
    // Partial ignore assignment
    var a: Int64
    (a, _) = (100, 200)
    println("\n(a, _) = (100, 200) => a = ${a}")
    
    // Assignment expression returns Unit
    println("\nAssignment expression demonstration:")
    score = 50
    println("Before assignment score = ${score}")
    let result = (score = 100)
    println("After assignment score = ${score}")
    println("Assignment expression value: ${result}")
}
main() {
    // Basic assignment
    var score: Int64 = 10
    println("Initial score: ${score}")
    
    score = 15
    println("After reassignment: ${score}")
    
    // Compound assignment operators
    score += 5      // Equivalent to score = score + 5
    println("score += 5 => ${score}")
    
    score *= 2      // Equivalent to score = score * 2
    println("score *= 2 => ${score}")
    
    score -= 10     // Equivalent to score = score - 10
    println("score -= 10 => ${score}")
    
    score /= 2      // Equivalent to score = score / 2
    println("score /= 2 => ${score}")
    
    score %= 7      // Equivalent to score = score % 7
    println("score %= 7 => ${score}")
    
    // Exponentiation assignment
    score = 2
    score **= 3     // Equivalent to score = score ** UInt64(3), right operand needs to be UInt64
    println("2 **= 3 => ${score}")
    
    // Assignment expression type is Unit
    println("\n=== Value of Assignment Expression ===")
    let unitValue = (score = 100)
    println("Value of assignment expression: ${unitValue}")
    println("After assignment score = ${score}")
    
    // Logical compound assignment
    var flag = true
    println("\n=== Logical Compound Assignment ===")
    println("Initial flag = ${flag}")
    
    flag &&= false  // Equivalent to flag = flag && false
    println("flag &&= false => ${flag}")
    
    flag ||= true   // Equivalent to flag = flag || true
    println("flag ||= true => ${flag}")
}
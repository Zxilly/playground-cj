main() {
    let number = 15

    // Pattern guard: add condition check after matching
    match (number) {
        case n where n < 0 => println("${n} is negative")
        case n where n == 0 => println("Zero")
        case n where n % 2 == 0 => println("${n} is positive even")
        case n => println("${n} is positive odd")
    }

    // Practical application: grade evaluation
    let score = 82
    let grade = match (score) {
        case s where s >= 90 => "A (Excellent)"
        case s where s >= 80 => "B (Good)"
        case s where s >= 70 => "C (Average)"
        case s where s >= 60 => "D (Pass)"
        case _ => "F (Fail)"
    }
    println("Score ${score} => ${grade}")

    // Using guards with value patterns
    let temp = 25
    match (temp) {
        case t where t < 0 => println("Freezing")
        case t where t < 15 => println("Cold")
        case t where t < 25 => println("Cool")
        case t where t == 25 => println("Comfortable")
        case t => println("Hot")
    }
}
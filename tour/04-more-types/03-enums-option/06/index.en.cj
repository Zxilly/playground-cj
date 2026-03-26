// Describe the content of an Option
func describeOption(opt: Option<Int64>): String {
    match (opt) {
        case Some(v) => "Contains value: ${v}"
        case None => "Empty value"
    }
}

// Find score by name
func findGrade(name: String): Option<Int64> {
    match (name) {
        case "Alice" => Some(95)
        case "Bob" => Some(82)
        case "Carol" => Some(91)
        case _ => None
    }
}

// Convert score to letter grade (using guards)
func getLetterGrade(score: Option<Int64>): String {
    match (score) {
        case Some(s) where s >= 90 => "A"
        case Some(s) where s >= 80 => "B"
        case Some(s) where s >= 70 => "C"
        case Some(_) => "F"
        case None => "N/A"
    }
}

main() {
    // Test the describe function
    println(describeOption(Some(42)))
    println(describeOption(None))
    println()

    // Find and display grades for multiple students
    let names = ["Alice", "Bob", "Dave", "Carol"]
    for (name in names) {
        let grade = findGrade(name)
        let letter = getLetterGrade(grade)

        match (grade) {
            case Some(score) =>
                println("${name}: ${score} points (${letter})")
            case None =>
                println("${name}: grade record not found")
        }
    }
}
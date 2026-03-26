main() {
    let grade = "B"

    // Match string literals
    match (grade) {
        case "A" => println("Excellent")
        case "B" => println("Good")
        case "C" => println("Pass")
        case _ => println("Other grade")
    }

    // Use | to match multiple values
    let month = 8
    let season = match (month) {
        case 3 | 4 | 5 => "Spring"
        case 6 | 7 | 8 => "Summer"
        case 9 | 10 | 11 => "Autumn"
        case 12 | 1 | 2 => "Winter"
        case _ => "Invalid month"
    }
    println("Month ${month} is ${season}")

    // Multi-value matching can also be used for booleans and other types
    let isWeekend = true
    match (isWeekend) {
        case true => println("Time to rest!")
        case false => println("Keep working hard")
    }
}
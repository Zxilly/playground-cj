main() {
    let day = 3

    // match returns a value, assigned to variable
    let name = match (day) {
        case 1 => "Monday"
        case 2 => "Tuesday"
        case 3 => "Wednesday"
        case 4 => "Thursday"
        case 5 => "Friday"
        case 6 => "Saturday"
        case 7 => "Sunday"
        case _ => "Invalid date"
    }
    println("Today is ${name}")

    // match can also be used as a statement without returning a value
    match (day) {
        case 1 | 2 | 3 | 4 | 5 => println("Weekday")
        case 6 | 7 => println("Weekend")
        case _ => println("Invalid")
    }
}
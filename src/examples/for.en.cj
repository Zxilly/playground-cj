package playground

// Example: Compute the starting weekday of each month in 2024
// Features: for-in loops, arrays, tuples, destructuring, string interpolation

main() {
    let weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    let months = [
        ("Jan", 31), ("Feb", 29), ("Mar", 31), ("Apr", 30),
        ("May", 31), ("Jun", 30), ("Jul", 31), ("Aug", 31),
        ("Sep", 30), ("Oct", 31), ("Nov", 30), ("Dec", 31)
    ]

    // January 1, 2024 falls on a Monday (index 0)
    var dayOfWeek = 0
    println("First day of each month in 2024:")
    for ((month, days) in months) {
        println("  ${month} 1: ${weekdays[dayOfWeek]}")
        dayOfWeek = (dayOfWeek + days) % 7
    }
}

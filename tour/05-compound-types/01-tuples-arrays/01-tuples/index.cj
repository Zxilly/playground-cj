main() {
    // Creating tuples
    let point = (3, 4)
    let person = ("Alice", 30, true)

    // Accessing elements by index
    println("x = ${point[0]}, y = ${point[1]}")
    println("Name: ${person[0]}, Age: ${person[1]}")

    // Destructuring
    let (x, y) = point
    println("Destructured: x = ${x}, y = ${y}")

    let (name, age, active) = person
    println("${name} is ${age} years old, active: ${active}")

    // Tuples as function return values
    let pair = swap(1, 2)
    println("Swapped: (${pair[0]}, ${pair[1]})")
}

func swap(a: Int64, b: Int64): (Int64, Int64) {
    (b, a)
}
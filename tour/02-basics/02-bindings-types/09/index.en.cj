main() {
    let name = "Cangjie"
    let version = 1
    let lessons = 3

    // Basic interpolation
    println("Welcome to ${name} language!")
    println("Version: ${version}")
    println("Planning to complete ${lessons} lessons today.")

    // Using expressions in interpolation
    println("Next lesson number is ${lessons + 1}.")
    println("Completing ${lessons} lessons takes about ${lessons * 30} minutes.")

    // Using complex expressions in interpolation
    let price = 99.9
    let quantity = 3
    println("Total price: ${price * Float64(quantity)}")

    // Using declarations in interpolation
    let area = "Area of circle with radius 2: ${let r = 2.0; let PI = 3.141592; PI * r * r}"
    println(area)

    // Multi-line string
    let multiline = """
        First line
        Second line
        Third line
        """
    print(multiline)

    // Multi-line raw string (escape characters not interpreted)
    let raw = ###"Raw string with \\n not a newline"###
    println("Raw string: ${raw}")

    // String concatenation
    let greeting = "Hello, " + name + "!"
    println(greeting)

    // String comparison
    let s1 = "abc"
    let s2 = "ABC"
    println("'${s1}' == '${s2}': ${s1 == s2}")
}
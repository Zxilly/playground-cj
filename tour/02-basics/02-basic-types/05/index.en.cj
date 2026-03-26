main() {
    // Single-line string (double quotes)
    let name = "Cangjie"
    println("Welcome to ${name} language!")

    // Single-line string (single quotes)
    let greeting = 'Hello World'
    println("Greeting: ${greeting}")

    // String concatenation
    let firstName = "Zhang"
    let lastName = "San"
    let fullName = firstName + lastName
    println("Full name: ${fullName}")

    // Multi-line string
    let multiline = """
        This is a
        multi-line string
        example
    """
    println(multiline)

    // Interpolated strings
    let version = 1
    let lessons = 3
    let remaining = lessons - 1
    println("Version: ${version}")
    println("Planning to complete ${lessons} lessons today")
    println("Completed 1 lesson, ${remaining} remaining")

    // Interpolation containing complex expressions
    let a = 10
    let b = 20
    println("${a} + ${b} = ${a + b}")

    // Interpolation containing declaration
    let info = "Pi is approximately ${let pi = 3.14159; pi}"
    println(info)

    // String comparison
    let s1 = "hello"
    let s2 = "HELLO"
    println("'${s1}' == '${s2}': ${s1 == s2}")
    println("'${s1}' != '${s2}': ${s1 != s2}")

    // String operations
    let text = "Hello, Cangjie!"
    println("Contains 'Cangjie': ${text.contains("Cangjie")}")
}
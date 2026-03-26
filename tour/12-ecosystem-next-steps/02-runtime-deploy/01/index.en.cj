// Compile this file: cjc hello.cj -o hello
// Then run:          ./hello

main() {
    println("Welcome to Cangjie programming language!")
    println("This is a program compiled to native binary.")
    
    // Simple calculation example
    let sum = 0
    for (i in 1..=10) {
        sum += i
    }
    println("Sum from 1 to 10 is: ${sum}")
    
    // Demonstrate string interpolation
    let language = "Cangjie"
    let year = 2024
    println("${language} language, year ${year}")
}
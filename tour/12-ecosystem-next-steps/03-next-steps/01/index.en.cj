// Save as hello.cj file
// Compile command: cjc hello.cj
// Run command: ./main (Linux/macOS) or main.exe (Windows)

main() {
    println("=== Cangjie Tour Graduate ===")
    println("You have learned:")
    
    let skills = [
        "Basic syntax and type system",
        "Functions and closures",
        "Classes, interfaces and generics",
        "Error handling",
        "Concurrent programming",
        "Collections and iterators"
    ]
    
    var count = 1
    for (skill in skills) {
        println("  ${count}. ${skill}")
        count++
    }
    
    println("\nNext step: Create your own project, explore the standard library!")
}
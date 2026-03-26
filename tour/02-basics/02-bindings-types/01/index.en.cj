main() {
    // Immutable binding with initial value
    let name = "Cangjie"
    let year = 2024
    
    // Declare type first, delayed initialization
    let text: String
    text = "Cangjie created characters"
    
    println("Language: ${name}")
    println("Year: ${year}")
    println("Text: ${text}")

    // The following code will cause a compilation error:
    // name = "Other"  // Error! let binding cannot be reassigned
}
main() {
    // Define immutable bindings, types are automatically inferred from initial values
    let name = "Cangjie"
    let year = 2024
    let pi = 3.14159
    
    println("Language: ${name}")
    println("Year: ${year}")
    println("Pi: ${pi}")
    
    // The following code would cause a compilation error:
    // name = "Other"  // Error! let bindings cannot be modified
}
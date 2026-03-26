// Example project created by cjpm
// Project structure:
// my_project/
// ├── cjpm.toml        # Project configuration file
// └── src/
//     └── main.cj      # Main program entry

// cjpm.toml content example:
// [package]
//   cjc-version = "1.0.0"
//   name = "my_project"
//   version = "1.0.0"
//   output-type = "executable"
//
// [dependencies]
//   // Add third-party dependencies here

// src/main.cj content:
package my_project

main(): Int64 {
    println("Project name: my_project")
    println("Version: 1.0.0")
    
    // In real projects, you can use more features
    let numbers = [10, 20, 30, 40, 50]
    var sum = 0
    for (n in numbers) {
        sum += n
    }
    
    println("Sum of numbers: ${sum}")
    println("Average: ${sum / numbers.size}")
    
    return 0
}

// Common cjpm commands:
// cjpm init       Create a new project
// cjpm build      Build the project
// cjpm run        Build and run
// cjpm test       Run tests
// cjpm clean      Clean build artifacts
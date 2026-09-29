// CJNative backend compilation:
//   cjc backend_demo.cj -o backend_demo

// Define different functions based on backend type
@When[backend == "cjnative"]
func getBackendInfo(): String {
    "CJNative native backend - compiles directly to machine code"
}

// Common backend-agnostic code
func calculateSequence(n: Int64): Int64 {
    var result = 0
    for (i in 1..=n) {
        result += i * i
    }
    result
}

@When[arch == "x86_64"]
func getArchitecture(): String { "x86_64" }

@When[arch == "aarch64"]
func getArchitecture(): String { "aarch64" }

main() {
    println("=== Compilation Backend Demo ===")
    
    // Output the current backend being used
    println("Current backend: ${getBackendInfo()}")
    
    // Execute common calculation
    let n = 10
    let sum = calculateSequence(n)
    println("Sum of 1² to ${n}²: ${sum}")
    
    // Display architecture information
    println("Running platform: ${getArchitecture()}")
    
    println("Program execution complete!")
}
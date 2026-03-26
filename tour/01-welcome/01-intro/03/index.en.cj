// Filename: hello.cj
// Compile command: cjc hello.cj -o hello
main() {
    let target = "local environment"
    let status = "OK"
    
    println("Running in ${target}...")
    println("Compiler status: ${status}")
    
    // Simple arithmetic operations
    let a = 10
    let b = 20
    println("Calculation result: ${a} + ${b} = ${a + b}")
}
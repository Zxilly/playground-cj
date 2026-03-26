// Compile this file:
//   cjc hello.cj            (outputs default filename: main)
//   cjc hello.cj -o hello   (specify output filename)
// Run:
//   ./main  or  ./hello

main(): Unit {
    println("Hello, Cangjie!")
    println("Compiled with cjc!")
    
    let message = "Welcome to Cangjie compiler"
    println(message)
}
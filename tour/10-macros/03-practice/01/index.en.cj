// Demonstrating how the dprint macro works
// The actual @dprint macro would expand at compile time to code similar to below

main() {
    let x = 3
    let y = 2
    
    // Assuming @dprint(x + y), code after macro expansion:
    print("x + y = ")
    println(x + y)
    
    // Assuming @dprint(x * y), code after macro expansion:
    print("x * y = ")
    println(x * y)
    
    // Assuming @dprint(x - y), code after macro expansion:
    print("x - y = ")
    println(x - y)
    
    // dprint2 macro for multiple expressions
    // @dprint2(x, y, x + y) would expand to:
    print("x = ")
    println(x)
    print("y = ")
    println(y)
    print("x + y = ")
    println(x + y)
}
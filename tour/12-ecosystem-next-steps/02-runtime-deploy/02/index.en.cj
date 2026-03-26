// Dynamic linking compilation (default):
//   cjc runtime_check.cj -o runtime_check
//   export LD_LIBRARY_PATH=$CANGJIE_HOME/runtime/lib/linux_x86_64_cjnative:$LD_LIBRARY_PATH
//   ./runtime_check
//
// Static linking compilation (Linux only):
//   cjc runtime_check.cj -o runtime_check --static
//   ./runtime_check

main() {
    println("=== Cangjie Runtime Check ===")
    
    // Test basic data type operations
    let nums = [10, 20, 30, 40, 50]
    var total = 0
    for (n in nums) {
        total += n
    }
    println("Sum of array elements: ${total}")
    
    // Test string operations (depends on runtime)
    let text = "Cangjie Runtime"
    println("String length: ${text.size}")
    println("String content: ${text}")
    
    // Test object creation (depends on memory management)
    class Point {
        let x: Int64
        let y: Int64
        init(x: Int64, y: Int64) {
            this.x = x
            this.y = y
        }
    }
    let p = Point(100, 200)
    println("Coordinate point: (${p.x}, ${p.y})")
    
    println("Runtime check complete, everything is normal!")
}
main() {
    let score: Int64 = 95
    let title: String = "Cangjie Introduction"
    let ready: Bool = true

    println("Score: ${score}")
    println("Title: ${title}")
    println("Ready: ${ready}")

    // Type mismatch will cause compilation error
    // let wrong: Bool = 42  // Error! Cannot initialize Bool type with integer
    
    // Type annotation can narrow literal type
    let small: Int32 = 100  // 100 is normally inferred as Int64, here it becomes Int32
    println("Small integer: ${small}")
}
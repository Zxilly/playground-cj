// Closures: functions that capture outer variables

func makeAdder(base: Int64): (Int64) -> Int64 {
    // Lambda captures parameter base
    { value: Int64 => value + base }
}

func makeCounter(start: Int64): () -> Int64 {
    var count = start
    
    // Nested function captures var variable
    // Note: functions capturing var can only be called, not used as first-class citizens
    func increment(): Int64 {
        count = count + 1
        count
    }
    
    return increment
}

func makeGreeter(prefix: String): () -> String {
    let saved = prefix
    // Returned lambda captures saved
    { => "${saved}, Cangjie!" }
}

main() {
    // Create two independent closures
    let add10 = makeAdder(10)
    let add20 = makeAdder(20)
    
    println("add10(5) = ${add10(5)}")  // 15
    println("add20(5) = ${add20(5)}")  // 25
    
    // Closures each hold independent captured values
    println("add10(8) = ${add10(8)}")  // 18
    
    // String closure
    let greetHello = makeGreeter("Hello")
    let greetHi = makeGreeter("Hi")
    
    println(greetHello())
    println(greetHi())
}
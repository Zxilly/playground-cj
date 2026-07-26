// Closures: functions that capture outer variables

class CounterState {
    var count: Int64

    init(count: Int64) {
        this.count = count
    }
}

func makeAdder(base: Int64): (Int64) -> Int64 {
    // Lambda captures parameter base
    { value: Int64 => value + base }
}

func makeCounter(start: Int64): () -> Int64 {
    let state = CounterState(start)
    
    // Escaping closures cannot capture a local var directly. Capture an
    // immutable class reference instead and update its mutable member.
    func increment(): Int64 {
        state.count = state.count + 1
        state.count
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

    // A captured reference can hold mutable state across calls
    let counter = makeCounter(0)
    println("counter() = ${counter()}")  // 1
    println("counter() = ${counter()}")  // 2
    
    // String closure
    let greetHello = makeGreeter("Hello")
    let greetHi = makeGreeter("Hi")
    
    println(greetHello())
    println(greetHi())
}

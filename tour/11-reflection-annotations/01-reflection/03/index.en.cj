import std.reflect.*

class Greeter {
    public func hello(): Unit {
        println("Hello from reflection!")
    }
}

main(): Unit {
    let g = Greeter()
    let ti = TypeInfo.of(g)
    println("Type: ${ti.name}")
    // Reflection method invocation - explore the API
}

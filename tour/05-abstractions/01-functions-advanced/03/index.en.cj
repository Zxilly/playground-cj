func makeAdder(base: Int64): (Int64) -> Int64 {
    let offset = base
    {value: Int64 => value + offset}
}

func makeGreeter(prefix: String): () -> String {
    let saved = prefix
    func greet() {
        "${saved}, Cangjie"
    }
    greet
}

main() {
    let add10 = makeAdder(10)
    println(add10(5))

    let greet = makeGreeter("hello")
    println(greet())
}

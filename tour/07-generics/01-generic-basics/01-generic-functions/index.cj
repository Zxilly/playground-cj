func identity<T>(x: T): T {
    return x
}

func makePair<A, B>(a: A, b: B): (A, B) {
    return (a, b)
}

main() {
    // Type is inferred automatically
    let n = identity(42)
    println("identity(42) = ${n}")

    let s = identity("hello")
    println("identity(\"hello\") = ${s}")

    // Multiple type parameters
    let pair = makePair("age", 25)
    println("pair = ${pair}")
}
func makeCounter(): () -> Int64 {
    var count = 0
    return { =>
        count += 1
        count
    }
}

func makeAdder(base: Int64): (Int64) -> Int64 {
    return { x: Int64 => base + x }
}

main() {
    // Each counter has its own captured state
    let counter1 = makeCounter()
    let counter2 = makeCounter()

    println("counter1: ${counter1()}")
    println("counter1: ${counter1()}")
    println("counter1: ${counter1()}")
    println("counter2: ${counter2()}")

    // Closure capturing a parameter
    let add10 = makeAdder(10)
    let add20 = makeAdder(20)
    println("add10(5) = ${add10(5)}")
    println("add20(5) = ${add20(5)}")
}
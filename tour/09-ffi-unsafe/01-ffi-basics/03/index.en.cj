foreign func rand(): Int32

// An entire function can be marked unsafe.
unsafe func getRandomPair(): (Int32, Int32) {
    return (rand(), rand())
}

main() {
    // unsafe block — required to call foreign functions.
    let n = unsafe { rand() }
    println("Single: ${n}")

    // Calling an unsafe function also requires unsafe context.
    let pair = unsafe { getRandomPair() }
    println("Pair: (${pair[0]}, ${pair[1]})")
}

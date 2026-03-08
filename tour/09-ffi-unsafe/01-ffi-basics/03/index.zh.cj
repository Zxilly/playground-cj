foreign func rand(): Int32

// 整个函数可以标记为 unsafe。
unsafe func getRandomPair(): (Int32, Int32) {
    return (rand(), rand())
}

main() {
    // unsafe 块——调用 foreign 函数时必须使用。
    let n = unsafe { rand() }
    println("Single: ${n}")

    // 调用 unsafe 函数同样需要 unsafe 上下文。
    let pair = unsafe { getRandomPair() }
    println("Pair: (${pair[0]}, ${pair[1]})")
}

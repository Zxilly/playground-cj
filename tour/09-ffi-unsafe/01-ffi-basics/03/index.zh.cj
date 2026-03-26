foreign func rand(): Int32

// 整个函数可以标记为 unsafe
// 调用 unsafe 函数同样需要 unsafe 上下文
unsafe func getRandomPair(): (Int32, Int32) {
    return (rand(), rand())
}

// unsafe 函数可以包含多个 unsafe 操作
unsafe func rollDice(): Int32 {
    let n = rand()
    // 将随机数映射到 1-6
    return (n % 6) + 1
}

main() {
    // unsafe 块 - 调用 foreign 函数时必须使用
    let single = unsafe { rand() }
    println("单个随机数: ${single}")
    
    // 调用 unsafe 函数同样需要 unsafe 上下文
    let pair = unsafe { getRandomPair() }
    println("随机数对: (${pair[0]}, ${pair[1]})")
    
    // 模拟掷骰子
    println("掷骰子结果: ${unsafe { rollDice() }}")
    
    // unsafe 块可以包含多条语句
    unsafe {
        let a = rand()
        let b = rand()
        let sum = a + b
        println("unsafe 块内计算和: ${sum}")
    }
}
// 尾随 Lambda：函数调用的语法糖

func myIf(flag: Bool, onTrue: () -> Int64): Int64 {
    if (flag) {
        onTrue()
    } else {
        0
    }
}

func applyTwice(action: (Int64) -> Int64): Int64 {
    action(action(2))
}

func repeat(n: Int64, action: (Int64) -> Unit): Unit {
    for (i in 1..=n) {
        action(i)
    }
}

main() {
    // 常规调用
    println(myIf(true, { => 100 }))
    
    // 尾随 Lambda：更清晰的写法
    println(myIf(true) {
        100
    })
    
    // 只有一个函数参数时，括号可省略
    println(applyTwice { value => value + 3 })
    
    // 等价于
    println(applyTwice({ value: Int64 => value + 3 }))
    
    // 常见模式：重复执行
    repeat(3) { i =>
        println("第 ${i} 次执行")
    }
    
    // 组合使用
    let result = myIf(5 > 3) {
        let x = 10
        x * 2
    }
    println("条件结果: ${result}")
}
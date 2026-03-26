// 闭包：捕获外层变量的函数

func makeAdder(base: Int64): (Int64) -> Int64 {
    // Lambda 捕获了参数 base
    { value: Int64 => value + base }
}

func makeCounter(start: Int64): () -> Int64 {
    var count = start
    
    // 嵌套函数捕获了 var 变量
    // 注意：捕获 var 的函数只能调用，不能作为一等公民使用
    func increment(): Int64 {
        count = count + 1
        count
    }
    
    return increment
}

func makeGreeter(prefix: String): () -> String {
    let saved = prefix
    // 返回的 Lambda 捕获了 saved
    { => "${saved}, Cangjie!" }
}

main() {
    // 创建两个独立的闭包
    let add10 = makeAdder(10)
    let add20 = makeAdder(20)
    
    println("add10(5) = ${add10(5)}")  // 15
    println("add20(5) = ${add20(5)}")  // 25
    
    // 闭包各持有独立的捕获值
    println("add10(8) = ${add10(8)}")  // 18
    
    // 字符串闭包
    let greetHello = makeGreeter("你好")
    let greetHi = makeGreeter("嗨")
    
    println(greetHello())
    println(greetHi())
}
// 闭包：捕获外层变量的函数

class CounterState {
    var count: Int64

    init(count: Int64) {
        this.count = count
    }
}

func makeAdder(base: Int64): (Int64) -> Int64 {
    // Lambda 捕获了参数 base
    { value: Int64 => value + base }
}

func makeCounter(start: Int64): () -> Int64 {
    let state = CounterState(start)
    
    // 逃逸闭包不能直接捕获局部 var；改为捕获不可变的类引用，
    // 再更新该引用指向对象的可变成员。
    func increment(): Int64 {
        state.count = state.count + 1
        state.count
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

    // 捕获的引用可以在多次调用之间保存可变状态
    let counter = makeCounter(0)
    println("counter() = ${counter()}")  // 1
    println("counter() = ${counter()}")  // 2
    
    // 字符串闭包
    let greetHello = makeGreeter("你好")
    let greetHi = makeGreeter("嗨")
    
    println(greetHello())
    println(greetHi())
}

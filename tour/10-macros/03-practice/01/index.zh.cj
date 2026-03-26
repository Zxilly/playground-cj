// 演示 dprint 宏的工作原理
// 实际的 @dprint 宏会在编译期展开为类似下面的代码

main() {
    let x = 3
    let y = 2
    
    // 假设有 @dprint(x + y)，宏展开后的代码：
    print("x + y = ")
    println(x + y)
    
    // 假设有 @dprint(x * y)，宏展开后的代码：
    print("x * y = ")
    println(x * y)
    
    // 假设有 @dprint(x - y)，宏展开后的代码：
    print("x - y = ")
    println(x - y)
    
    // 多个表达式的 dprint2 宏
    // @dprint2(x, y, x + y) 会展开为：
    print("x = ")
    println(x)
    print("y = ")
    println(y)
    print("x + y = ")
    println(x + y)
}
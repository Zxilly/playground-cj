// 使用 foreign 声明 C 标准库函数
// @C 注解在 foreign 声明上可以省略
foreign func rand(): Int32
foreign func abs(x: Int32): Int32
foreign func srand(seed: UInt32): Unit

main() {
    // foreign 函数必须在 unsafe 块中调用
    // 设置随机种子以获得可预测的随机序列
    unsafe { srand(42) }
    
    let r1 = unsafe { rand() }
    let r2 = unsafe { rand() }
    println("第一个随机数: ${r1}")
    println("第二个随机数: ${r2}")
    
    // 调用 C 标准库的绝对值函数
    let negative = -123
    let absolute = unsafe { abs(negative) }
    println("abs(${negative}) = ${absolute}")
    
    // 再次设置相同的种子，观察随机序列是否重复
    unsafe { srand(42) }
    let r3 = unsafe { rand() }
    println("重置种子后的随机数: ${r3} (应与第一个相同)")
}
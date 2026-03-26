main() {
    // 单行注释：这行代码会打印一条消息
    println("注释不会影响程序执行")
    
    // 单行注释可以跟在代码后面
    let x = 100  // 定义变量 x
    
    /* 
     * 多行注释可以跨越多行
     * 常用于描述复杂逻辑
     * 或临时禁用代码块
     */
    let y = 200
    println("x = ${x}, y = ${y}")
    
    /* 
     * 计算两个数的和与积
     */
    let sum = x + y
    let product = x * y
    println("${x} + ${y} = ${sum}")
    println("${x} * ${y} = ${product}")
    
    /* 仓颉的多行注释支持 /* 嵌套使用 */ */
    println("嵌套注释是仓颉的特色之一")
    
    // 临时注释掉的代码：
    // let z = 300
    // println("z = ${z}")
    
    // 说明：良好的注释解释"为什么"，而不是"做什么"
    let divisor = 1024  // 使用 1024 作为 KB 转换因子
    let bytes = 2048
    let kb = bytes / divisor
    println("${bytes} 字节 = ${kb} KB")
}
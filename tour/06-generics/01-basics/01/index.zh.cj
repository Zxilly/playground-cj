// 泛型函数：类型参数在函数名后的尖括号中声明
func pickFirst<T>(left: T, _: T): T {
    left
}

// 泛型函数可以有多个类型参数
func swap<T, U>(pair: (T, U)): (U, T) {
    let (first, second) = pair
    (second, first)
}

main() {
    // 显式指定类型实参
    let result1 = pickFirst<Int64>(10, 20)
    println("第一个值: ${result1}")

    // 也可以让编译器推断类型
    let result2 = pickFirst("hello", "world")
    println("第一个字符串: ${result2}")

    // 交换元组的元素顺序
    let pair1: (String, Int64) = ("年龄", 18)
    let swapped = swap<String, Int64>(pair1)
    println("交换后: ${swapped}")

    // 使用类型推断
    let pair2 = ("分数", 95)
    let swapped2 = swap(pair2)
    println("交换后: ${swapped2}")
}
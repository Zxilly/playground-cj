// Any 可以持有任何类型的值
func printValue(value: Any) {
    match (value) {
        case i: Int64 => 
            println("整数: ${i}，平方: ${i * i}")
        case f: Float64 =>
            println("浮点数: ${f}，四舍五入: ${f}")
        case s: String =>
            println("字符串: \"${s}\"，长度: ${s.size}")
        case b: Bool =>
            println("布尔值: ${b}，取反: ${!b}")
        case _ => 
            println("其他类型的值")
    }
}

// 灵活的数据容器
class Box {
    let value: Any

    init(value: Any) {
        this.value = value
    }

    func describe(): String {
        match (value) {
            case i: Int64 => "整数盒子[${i}]"
            case s: String => "字符串盒子[${s}]"
            case arr: Array<Any> => "盒子数组，长度${arr.size}"
            case _ => "未知盒子"
        }
    }

    // 尝试获取整数值
    func getInt(): Option<Int64> {
        match (value) {
            case i: Int64 => Some(i)
            case _ => None
        }
    }
}

// 处理混合类型数据
func sumNumbers(values: Array<Any>) {
    var total: Int64 = 0
    for (v in values) {
        match (v) {
            case i: Int64 => total += i
            case f: Float64 => total += Int64(f)
            case _ => ()  // 忽略非数值
        }
    }
    println("总和: ${total}")
}

main() {
    println("=== Any 类型演示 ===\n")

    // Any 可以持有任何值
    printValue(42)
    printValue(3.14159)
    printValue("你好，仓颉")
    printValue(true)
    printValue(Dog())  // 自定义类型

    // 可变长数据混合存储
    println("\n=== 混合数据容器 ===")
    let mixed: Array<Any> = [
        42, "hello", 3.14, true, [1, 2, 3]
    ]
    
    println("遍历混合数组:")
    for (item in mixed) {
        printValue(item)
    }

    // Box 容器示例
    println("\n=== Box 容器 ===")
    let box1 = Box(123)
    let box2 = Box("仓颉语言")
    println(box1.describe())
    println(box2.describe())

    if (let Some(n) <- box1.getInt()) {
        println("取出的整数: ${n}")
    }

    // 数字求和
    println("\n=== 混合类型求和 ===")
    let numbers: Array<Any> = [10, 20.5, 30, "不是数字", 15, 4.0]
    sumNumbers(numbers)
}

// 辅助类
class Dog {
    public func toString(): String {
        "一只狗"
    }
}
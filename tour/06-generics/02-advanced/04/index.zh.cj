// 定义可显示接口
interface Displayable {
    func display(): String
}

// 定义可比较接口
interface Comparable<T> {
    func compareTo(other: T): Int64
}

// Score 类同时实现两个接口
class Score <: Displayable & Comparable<Score> {
    let value: Int64
    let subject: String

    init(subject: String, value: Int64) {
        this.subject = subject
        this.value = value
    }

    // 实现 Displayable 接口
    public func display(): String {
        "${subject}: ${value} 分"
    }

    // 实现 Comparable 接口
    public func compareTo(other: Score): Int64 {
        this.value - other.value
    }
}

// 单约束泛型函数：只需要 Comparable
// 返回较大的那个值
func findMax<T>(a: T, b: T): T where T <: Comparable<T> {
    if (a.compareTo(b) > 0) {
        a
    } else {
        b
    }
}

// 双重约束泛型函数：需要 Comparable 和 Displayable
// 找出最大值并显示
func showMax<T>(a: T, b: T): Unit where T <: Comparable<T> & Displayable {
    let max = findMax(a, b)  // 调用单约束函数
    println("最高分: ${max.display()}")
}

// 三重约束示例：比较、显示、还能计数
interface Countable {
    func count(): Int64
}

func process<T>(a: T, b: T): Unit where T <: Comparable<T> & Displayable & Countable {
    println("处理两个项目...")
    println("项目 A: ${a.display()}")
    println("项目 B: ${b.display()}")
    
    let max = findMax(a, b)
    println("较大者: ${max.display()}")
}

main() {
    let math1 = Score("数学", 85)
    let math2 = Score("数学", 92)

    println("比较两次数学成绩:")
    showMax(math1, math2)

    let english1 = Score("英语", 78)
    let english2 = Score("英语", 95)

    println("\n比较两次英语成绩:")
    showMax(english1, english2)
}
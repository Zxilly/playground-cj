// 密封类：限制子类必须在同一包内
sealed abstract class Result {
    public func message(): String
    public func isSuccess(): Bool
}

// 成功结果
class Success <: Result {
    let value: Int64

    public init(value: Int64) {
        this.value = value
    }

    public func message(): String {
        "成功: 值 = ${value}"
    }

    public func isSuccess(): Bool {
        true
    }
}

// 失败结果
class Failure <: Result {
    let reason: String

    public init(reason: String) {
        this.reason = reason
    }

    public func message(): String {
        "失败: 原因 = ${reason}"
    }

    public func isSuccess(): Bool {
        false
    }
}

// 处理结果的通用函数
func handleResult(result: Result): Unit {
    println("处理结果: ${result.message()}")

    if (result.isSuccess()) {
        println("  -> 操作成功，继续下一步")
    } else {
        println("  -> 操作失败，需要处理错误")
    }
}

main() {
    // 创建不同的结果
    let results: Array<Result> = [
        Success(42),
        Success(100),
        Failure("网络超时"),
        Failure("权限不足")
    ]

    println("处理所有结果:")
    for (result in results) {
        handleResult(result)
        println()
    }

    // 业务场景：根据类型处理
    println("业务处理:")
    let r1 = Success(200)
    let r2 = Failure("连接失败")

    println(r1.message())
    println("状态: ${if (r1.isSuccess()) "OK" else "Error"}")

    println()
    println(r2.message())
    println("状态: ${if (r2.isSuccess()) "OK" else "Error"}")

    // 编译器知道只有两个子类，便于优化
    // 如果用 match 表达式，可以穷尽所有情况
}
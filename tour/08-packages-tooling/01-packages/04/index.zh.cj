// 文件内部可见
private func secretHelper(): String {
    return "这是文件私有函数"
}

// 仅当前包及子包可见（默认值）
func packageGreet(): String {
    return "这是包内可见函数"
}

// 仅当前模块内可见
protected func moduleHelper(): String {
    return "这是模块内可见函数"
}

// 模块内外均可见
public func publicGreet(name: String): String {
    return "你好, ${name}! 这是对外公开的函数"
}

// 演示默认的 internal 可见性
class InternalClass {
    public func show(): String {
        return "InternalClass 默认是包内可见的"
    }
}

main(): Unit {
    // 所有函数在同一个文件内都可见
    println(secretHelper())
    println(packageGreet())
    println(moduleHelper())
    println(publicGreet("开发者"))
    
    // 类的使用
    let obj = InternalClass()
    println(obj.show())
    
    println("\n可见性总结:")
    println("private   - 仅当前文件")
    println("internal  - 当前包及子包（默认）")
    println("protected - 当前模块")
    println("public    - 所有地方")
}
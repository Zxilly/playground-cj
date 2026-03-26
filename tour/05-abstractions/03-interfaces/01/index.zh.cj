// 定义两个接口
interface Printable {
    func display(): String
}

interface Named {
    func name(): String {
        "anonymous"  // 默认实现
    }
}

// User 类同时实现两个接口
class User <: Printable & Named {
    let username: String

    init(username: String) {
        this.username = username
    }

    public func display(): String {
        "用户: ${username}"
    }

    public func name(): String {
        username  // 覆盖默认实现
    }
}

// Student 类使用 Named 的默认实现
class Student <: Printable & Named {
    let id: String

    init(id: String) {
        this.id = id
    }

    public func display(): String {
        "学生: ${id}"
    }
    // 没有提供 name()，使用默认值 "anonymous"
}

main() {
    let user = User("张三")
    let student = Student("S001")

    println("=== User ===")
    println(user.display())
    println("name = ${user.name()}")

    println("\n=== Student ===")
    println(student.display())
    println("name = ${student.name()}")  // 使用默认实现
}
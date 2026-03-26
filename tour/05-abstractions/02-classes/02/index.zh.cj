class Person {
    let name: String
    var age: Int64
    var email: String

    // 普通构造器：完整参数列表
    public init(name: String, age: Int64, email: String) {
        this.name = name
        this.age = age
        this.email = email
    }

    // 普通构造器：重载，省略 email
    public init(name: String, age: Int64) {
        this.name = name
        this.age = age
        this.email = "未设置"
    }

    // 成员函数
    public func describe(): String {
        "${name}（年龄: ${age}, 邮箱: ${email}）"
    }

    public func celebrateBirthday() {
        age += 1
        println("${name} 过生日了！现在 ${age} 岁")
    }
}

main() {
    // 使用不同的构造器创建对象
    let p1 = Person("小明", 25, "xiaoming@example.com")
    println(p1.describe())

    let p2 = Person("小红", 30)
    println(p2.describe())

    // 调用成员函数
    p1.celebrateBirthday()
    p2.celebrateBirthday()

    println("最终信息:")
    println(p1.describe())
    println(p2.describe())
}
// 定义使用命名参数的函数
// 注意：命名参数用 name!: Type 的形式定义
func createUser(name!: String, age!: Int64, email!: String) {
    println("创建用户：")
    println("  姓名：${name}")
    println("  年龄：${age}")
    println("  邮箱：${email}")
}

// 混合使用普通参数和命名参数
// 命名参数必须在普通参数之后
func sendEmail(to: String, subject!: String, body!: String) {
    println("发送邮件给 ${to}：")
    println("  主题：${subject}")
    println("  内容：${body}")
}

main() {
    // 调用时必须写出命名参数的名称
    createUser(name: "李华", age: 28, email: "lihua@example.com")
    println("---")
    
    // 命名参数可以按任意顺序传递
    createUser(email: "wang@demo.com", name: "王芳", age: 35)
    println("---")
    
    // 普通参数按位置传递，命名参数按名称传递
    sendEmail(
        "admin@example.com",
        subject: "系统通知",
        body: "您的账户已激活"
    )
    println("---")
    
    // 命名参数顺序可以调整，提高可读性
    sendEmail(
        "user@test.com",
        body: "这是一封测试邮件",
        subject: "测试"
    )
}
// 验证异常：携带字段名
open class ValidationError <: Exception {
    public let field: String

    public init(field: String, message: String) {
        this.field = field
        super(message)
    }

    public open override func getClassName(): String {
        "ValidationError"
    }
}

// 网络异常：携带状态码
open class NetworkError <: Exception {
    public let statusCode: Int64

    public init(statusCode: Int64, message: String) {
        this.statusCode = statusCode
        super(message)
    }

    public open override func getClassName(): String {
        "NetworkError"
    }
}

func validateEmail(email: String): Unit {
    if (!email.contains("@")) {
        throw ValidationError("email", "邮箱格式无效：${email}")
    }
}

func fetchData(url: String): String {
    if (url.isEmpty()) {
        throw NetworkError(400, "URL 不能为空")
    }
    "来自 ${url} 的数据"
}

main() {
    // 捕获验证异常
    try {
        validateEmail("alice_at_example.com")
        println("验证通过")
    } catch (e: ValidationError) {
        println("字段 '${e.field}' 验证失败：${e.message}")
    }

    // 正常情况
    try {
        validateEmail("bob@example.com")
        println("邮箱验证通过")
    } catch (e: ValidationError) {
        println("验证失败：${e.message}")
    }

    // 捕获网络异常
    try {
        let data = fetchData("")
        println("获取数据：${data}")
    } catch (e: NetworkError) {
        println("网络错误 (${e.statusCode})：${e.message}")
    }

    // 可以同时捕获两种异常
    try {
        let data = fetchData("https://api.example.com")
        println("成功：${data}")
    } catch (e: ValidationError) {
        println("验证错误：${e.message}")
    } catch (e: NetworkError) {
        println("网络错误：${e.message}")
    }
}
import std.collection.*

// 定义可标识接口
interface Identifiable {
    func getId(): String
}

// 泛型注册表类，要求元素实现 Identifiable 接口
class Registry<T> where T <: Identifiable {
    let items = HashMap<String, T>()

    // 注册新元素
    public func register(item: T): Unit {
        items.add(item.getId(), item)
        println("已注册: ID = ${item.getId()}")
    }

    // 根据 ID 查找元素
    public func find(id: String): Option<T> {
        if (items.contains(id)) {
            Some(items[id])
        } else {
            None
        }
    }

    // 移除元素
    public func remove(id: String): Bool {
        if (items.contains(id)) {
            items.remove(id)
            println("已移除: ID = ${id}")
            true
        } else {
            println("未找到: ID = ${id}")
            false
        }
    }

    // 获取总数
    public func count(): Int64 {
        items.size
    }

    // 列出所有 ID
    public func listAll(): Unit {
        println("当前已注册 ${count()} 个项目:")
        for ((id, _) in items) {
            println("  - ${id}")
        }
    }
}

// 用户类实现 Identifiable
class User <: Identifiable {
    let id: String
    let name: String
    let age: Int64

    init(id: String, name: String, age: Int64) {
        this.id = id
        this.name = name
        this.age = age
    }

    public func getId(): String {
        id
    }

    public func info(): String {
        "${name}, ${age} 岁"
    }
}

main() {
    // 创建用户注册表
    let users = Registry<User>()
    println("=== 用户注册系统 ===\n")

    // 注册用户
    users.register(User("u001", "张三", 25))
    users.register(User("u002", "李四", 30))
    users.register(User("u003", "王五", 28))

    // 列出所有用户
    println("")
    users.listAll()

    // 查找用户
    println("\n=== 查找用户 ===")
    match (users.find("u002")) {
        case Some(user) => println("找到: ${user.info()}")
        case None => println("用户不存在")
    }

    match (users.find("u999")) {
        case Some(user) => println("找到: ${user.info()}")
        case None => println("用户 u999 不存在")
    }

    // 移除用户
    println("\n=== 移除用户 ===")
    users.remove("u001")
    users.listAll()
}
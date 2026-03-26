class Address {
    public let city: String

    public init(city: String) {
        this.city = city
    }
}

class Profile {
    public var address: ?Address  // 地址可能不存在

    public init(address: ?Address) {
        this.address = address
    }
}

class User {
    public var profile: Profile

    public init(profile: Profile) {
        this.profile = profile
    }
}

// 使用可选链安全访问嵌套属性
func getCity(user: ?User): String {
    // user?.profile.address?.city 会自动处理链中的 None
    // 任何一环是 None 就返回 None，用 ?? 提供默认值
    return user?.profile.address?.city ?? "未知城市"
}

main() {
    // 完整的用户信息
    let alice = Some(User(
        Profile(Some(Address("上海")))
    ))

    // 用户存在，但地址缺失
    let bob = Some(User(
        Profile(None)
    ))

    // 用户不存在
    let guest: ?User = None

    // 使用可选链安全获取城市
    println("Alice 的城市: ${getCity(alice)}")
    println("Bob 的城市: ${getCity(bob)}")
    println("访客的城市: ${getCity(guest)}")

    // 直接在表达式中使用可选链
    let visitor = Some(User(Profile(Some(Address("北京")))))
    let city = visitor?.profile.address?.city ?? "无数据"
    println("访客的城市: ${city}")
}
class Address {
    public let city: String

    public init(city: String) {
        this.city = city
    }
}

class Profile {
    public var address: ?Address

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

func shippingLabel(user: ?User): String {
    let city = user?.profile.address?.city ?? "unknown city"
    return "Ship to ${city}"
}

main(): Int64 {
    let alice = Some(User(Profile(Some(Address("Shanghai")))))
    let guest: ?User = None
    let visitor = Some(User(Profile(None)))

    println(shippingLabel(alice))
    println(shippingLabel(visitor))
    println(shippingLabel(guest))
    return 0
}

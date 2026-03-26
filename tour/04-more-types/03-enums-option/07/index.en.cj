class Address {
    public let city: String

    public init(city: String) {
        this.city = city
    }
}

class Profile {
    public var address: ?Address  // Address may not exist

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

// Use optional chaining to safely access nested properties
func getCity(user: ?User): String {
    // user?.profile.address?.city automatically handles None in the chain
    // Returns None if any link is None, use ?? to provide default value
    return user?.profile.address?.city ?? "Unknown city"
}

main() {
    // Complete user information
    let alice = Some(User(
        Profile(Some(Address("Shanghai")))
    ))

    // User exists but address is missing
    let bob = Some(User(
        Profile(None)
    ))

    // User doesn't exist
    let guest: ?User = None

    // Use optional chaining to safely get city
    println("Alice's city: ${getCity(alice)}")
    println("Bob's city: ${getCity(bob)}")
    println("Guest's city: ${getCity(guest)}")

    // Use optional chaining directly in an expression
    let visitor = Some(User(Profile(Some(Address("Beijing")))))
    let city = visitor?.profile.address?.city ?? "No data"
    println("Visitor's city: ${city}")
}
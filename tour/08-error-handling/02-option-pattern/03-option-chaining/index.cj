import std.collection.*

func findUserAge(name: String): Option<Int64> {
    let ages = HashMap<String, Int64>()
    ages.put("Alice", 30)
    ages.put("Bob", 25)
    if (ages.contains(name)) {
        return Some(ages[name])
    }
    return None
}

main() {
    // getOrDefault - provide a fallback value
    let age1 = findUserAge("Alice").getOrDefault(0)
    let age2 = findUserAge("Unknown").getOrDefault(0)
    println("Alice's age: ${age1}")
    println("Unknown's age: ${age2}")

    // map - transform the value if present
    let doubled = findUserAge("Alice").map { a: Int64 => a * 2 }
    println("Alice's age doubled: ${doubled}")

    let missing = findUserAge("Nobody").map { a: Int64 => a * 2 }
    println("Nobody's age doubled: ${missing}")

    // flatMap - chain operations that return Option
    let result = findUserAge("Bob").flatMap { age: Int64 =>
        if (age >= 18) {
            Some("Adult (age ${age})")
        } else {
            None
        }
    }
    println("Bob status: ${result}")

    // isSome and isNone checks
    let opt1 = findUserAge("Alice")
    let opt2 = findUserAge("Nobody")
    println("Alice exists: ${opt1.isSome()}")
    println("Nobody exists: ${opt2.isSome()}")
}
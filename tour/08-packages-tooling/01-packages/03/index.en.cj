import std.collection.ArrayList as List
import std.collection.HashMap as Map

main(): Unit {
    let names = List<String>()
    names.append("Alice")
    names.append("Bob")

    let ages = Map<String, Int64>()
    ages["Alice"] = 30
    ages["Bob"] = 25

    for (name in names) {
        println("${name}: ${ages[name].getOrThrow()}")
    }
}

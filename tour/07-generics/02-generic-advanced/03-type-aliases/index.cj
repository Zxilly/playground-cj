import std.collection.*

type StringList = ArrayList<String>
type IntList = ArrayList<Int64>
type StringMap = HashMap<String, String>

func printStrings(list: StringList): Unit {
    for (s in list) {
        println("  ${s}")
    }
}

main() {
    // Using type alias instead of full generic type
    let names = StringList()
    names.append("Alice")
    names.append("Bob")
    names.append("Carol")
    println("Names:")
    printStrings(names)

    let scores = IntList()
    scores.append(95)
    scores.append(87)
    scores.append(92)
    println("Scores: ${scores}")

    let config = StringMap()
    config.put("host", "localhost")
    config.put("port", "8080")
    println("Config host: ${config["host"]}")
    println("Config port: ${config["port"]}")
}
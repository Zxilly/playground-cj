import std.collection.HashMap

main(): Int64 {
    let scores = HashMap<String, Int64>()
    scores.add("alice", 95)
    scores.add("bob", 88)
    scores["carol"] = 92

    if (scores.contains("alice")) {
        println("alice = ${scores["alice"]}")
    }

    scores["bob"] = 90
    scores.remove("carol")

    for ((name, score) in scores) {
        println("${name} => ${score}")
    }
    return 0
}

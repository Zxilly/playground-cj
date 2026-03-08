import std.collection.{ArrayList, HashMap}

main(): Int64 {
    let stages = ArrayList<String>(["parse", "type-check", "run"])

    for (stage in stages) {
        println("for-in => ${stage}")
    }

    var iterator = stages.iterator()
    while (let Some(stage) <- iterator.next()) {
        println("iterator => ${stage}")
    }

    let scores = HashMap<String, Int64>([("alice", 95), ("bob", 88)])
    for ((name, score) in scores) {
        println("${name}: ${score}")
    }
    return 0
}

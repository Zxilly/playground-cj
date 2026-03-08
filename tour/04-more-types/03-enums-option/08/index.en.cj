import std.collection.HashMap

func findScore(name: String): ?Int64 {
    let scores = HashMap<String, Int64>([("alice", 95), ("bob", 88)])
    if (scores.contains(name)) {
        return Some(scores[name])
    }
    return None
}

func withdraw(balance: Int64, amount: Int64): Int64 {
    if (amount < 0) {
        throw Exception("amount must be non-negative")
    }
    if (amount > balance) {
        throw Exception("balance is not enough")
    }
    return balance - amount
}

main(): Int64 {
    match (findScore("alice")) {
        case Some(score) => println("alice score = ${score}")
        case None => println("alice score not found")
    }

    match (findScore("carol")) {
        case Some(score) => println("carol score = ${score}")
        case None => println("carol score not found")
    }

    try {
        println("new balance = ${withdraw(100, 30)}")
        println("new balance = ${withdraw(100, 130)}")
    } catch (e: Exception) {
        println("withdraw failed:")
        println(e)
    }

    return 0
}

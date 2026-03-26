import std.collection.HashMap

// Find score: return Option because "not found" is a normal case
func findScore(name: String): ?Int64 {
    let scores = HashMap<String, Int64>([
        ("alice", 95),
        ("bob", 88)
    ])
    
    if (scores.contains(name)) {
        return scores[name]  // Automatically wrapped as Some
    }
    None  // User doesn't exist is a normal case
}

// Withdraw operation: throw exception because insufficient balance is an error
func withdraw(balance: Int64, amount: Int64): Int64 {
    if (amount < 0) {
        throw Exception("Withdrawal amount cannot be negative")
    }
    if (amount > balance) {
        throw Exception("Insufficient balance: current balance ${balance}, required ${amount}")
    }
    return balance - amount
}

main() {
    // Use Option to handle lookup results
    println("=== Find Score ===")
    
    match (findScore("alice")) {
        case Some(score) => 
            println("alice score: ${score}")
        case None => 
            println("alice has no score record")
    }

    match (findScore("carol")) {
        case Some(score) => 
            println("carol score: ${score}")
        case None => 
            println("carol has no score record")
    }

    // Use exception to handle error cases
    println("\n=== Withdraw Operation ===")

    // Normal withdrawal
    try {
        let newBalance = withdraw(100, 30)
        println("Withdrawal successful, new balance: ${newBalance}")
    } catch (e: Exception) {
        println("Withdrawal failed: ${e.message}")
    }

    // Insufficient balance
    try {
        let newBalance = withdraw(100, 130)
        println("Withdrawal successful, new balance: ${newBalance}")
    } catch (e: Exception) {
        println("Withdrawal failed: ${e.message}")
    }

    // Invalid amount
    try {
        let newBalance = withdraw(100, -10)
        println("Withdrawal successful, new balance: ${newBalance}")
    } catch (e: Exception) {
        println("Withdrawal failed: ${e.message}")
    }
}
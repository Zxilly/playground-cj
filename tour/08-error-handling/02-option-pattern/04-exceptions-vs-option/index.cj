import std.collection.*

// Option approach: lookup might not find anything (expected)
func findItem(items: HashMap<String, Int64>, key: String): Option<Int64> {
    if (items.contains(key)) {
        return Some(items[key])
    }
    return None
}

// Exception approach: invalid input is unexpected
func withdraw(balance: Int64, amount: Int64): Int64 {
    if (amount < 0) {
        throw Exception("Amount cannot be negative: ${amount}")
    }
    if (amount > balance) {
        throw Exception("Insufficient funds: need ${amount}, have ${balance}")
    }
    return balance - amount
}

main() {
    // Option: looking up items that may not exist
    let prices = HashMap<String, Int64>()
    prices.put("apple", 3)
    prices.put("banana", 2)

    let items = ["apple", "cherry", "banana"]
    for (item in items) {
        match (findItem(prices, item)) {
            case Some(price) => println("${item}: $${price}")
            case None => println("${item}: not in stock")
        }
    }

    println("")

    // Exception: handling truly unexpected errors
    var balance: Int64 = 100
    let transactions = [30, 50, 40]
    for (amount in transactions) {
        try {
            balance = withdraw(balance, amount)
            println("Withdrew ${amount}, balance: ${balance}")
        } catch (e: Exception) {
            println("Failed: ${e.message}")
        }
    }
}
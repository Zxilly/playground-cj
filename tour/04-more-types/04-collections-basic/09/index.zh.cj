import std.collection.*

func wordCount(words: Array<String>): HashMap<String, Int64> {
    let counts = HashMap<String, Int64>()
    // TODO: 实现词频统计
    return counts
}

main(): Unit {
    let words = ["apple", "banana", "apple", "cherry", "banana", "apple"]
    let result = wordCount(words)
    println(result)
}

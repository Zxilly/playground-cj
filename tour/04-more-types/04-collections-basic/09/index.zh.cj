import std.collection.HashMap

func wordCount(words: Array<String>): HashMap<String, Int64> {
    let counts = HashMap<String, Int64>()
    
    // TODO: 遍历 words 数组
    // TODO: 统计每个单词的出现次数
    // TODO: 如果单词已存在，计数加一
    // TODO: 如果单词不存在，插入初始值 1
    
    return counts
}

main(): Unit {
    let words = ["apple", "banana", "apple", "cherry", "banana", "apple"]
    
    println("输入数组：")
    for (word in words) {
        print("${word} ")
    }
    println("\n")
    
    let result = wordCount(words)
    
    println("词频统计结果：")
    for ((word, count) in result) {
        println("  ${word} => ${count}")
    }
    
    println("\n预期结果：")
    println("  apple => 3")
    println("  banana => 2")
    println("  cherry => 1")
}
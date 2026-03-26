import std.collection.HashMap

func wordCount(words: Array<String>): HashMap<String, Int64> {
    let counts = HashMap<String, Int64>()
    
    // TODO: Iterate through the words array
    // TODO: Count the occurrence of each word
    // TODO: If the word exists, increment the count
    // TODO: If the word doesn't exist, insert initial value 1
    
    return counts
}

main(): Unit {
    let words = ["apple", "banana", "apple", "cherry", "banana", "apple"]
    
    println("Input array:")
    for (word in words) {
        print("${word} ")
    }
    println("\n")
    
    let result = wordCount(words)
    
    println("Word frequency count result:")
    for ((word, count) in result) {
        println("  ${word} => ${count}")
    }
    
    println("\nExpected result:")
    println("  apple => 3")
    println("  banana => 2")
    println("  cherry => 1")
}
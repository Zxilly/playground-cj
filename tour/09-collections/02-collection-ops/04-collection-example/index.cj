import std.collection.*

func wordCount(text: String): HashMap<String, Int64> {
    let counts = HashMap<String, Int64>()
    let words = text.split(" ")
    for (word in words) {
        let w = word.toLower()
        if (w.isEmpty()) { continue }
        if (counts.contains(w)) {
            counts.put(w, counts[w] + 1)
        } else {
            counts.put(w, 1)
        }
    }
    return counts
}

main() {
    let text = "the cat sat on the mat the cat ate the rat on the mat"
    println("Text: \"${text}\"")
    println("")

    // Count words
    let counts = wordCount(text)

    // Display counts
    println("Word frequencies:")
    for ((word, count) in counts) {
        let bar = ArrayList<String>()
        for (_ in 0..count) {
            bar.append("#")
        }
        println("  ${word}: ${count} ${bar}")
    }

    // Find most common word
    var maxWord = ""
    var maxCount: Int64 = 0
    for ((word, count) in counts) {
        if (count > maxCount) {
            maxWord = word
            maxCount = count
        }
    }
    println("\nMost common: '${maxWord}' (${maxCount} times)")

    // Unique word count
    let uniqueWords = HashSet<String>()
    for ((word, _) in counts) {
        uniqueWords.put(word)
    }
    println("Unique words: ${uniqueWords.size}")
}
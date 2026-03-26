main() {
    let scores = [90, 85, 78, 92, 88, 76]
    println("All scores: ${scores}")
    
    // Basic slicing: start..end (not including end)
    let top3 = scores[0..3]
    println("Top 3: ${top3}")
    
    // Omit start position, begins from 0
    let first4 = scores[..4]
    println("First 4: ${first4}")
    
    // Omit end position, goes to array end
    let last3 = scores[3..]
    println("Last 3: ${last3}")
    
    // Slicing returns a new array, modifying doesn't affect original
    let slice = scores[1..3]
    println("Slice: ${slice}")
    
    // Using slice is a new array (need var to modify elements)
    // Note: slice here is let, so cannot modify
    
    // Iterate by index
    println("Iterate by index:")
    for (i in 0..scores.size) {
        println("  scores[${i}] = ${scores[i]}")
    }
    
    // Get both index and value
    println("Index and value:")
    for ((index, value) in scores.enumerate()) {
        println("  [${index}] = ${value}")
    }
}
import std.collection.ArrayList

func sortAscending(values: ArrayList<Int64>): Unit {
    var i = 0
    while (i < values.size) {
        // Find the index of the minimum value among remaining elements
        var minIndex = i
        var j = i + 1
        while (j < values.size) {
            if (values[j] < values[minIndex]) {
                minIndex = j
            }
            j += 1
        }
        
        // Swap current position with minimum value position
        if (minIndex != i) {
            let temp = values[i]
            values[i] = values[minIndex]
            values[minIndex] = temp
        }
        
        i += 1
    }
}

main(): Int64 {
    let scores = ArrayList<Int64>([42, 7, 19, 88, 7, 23, 56])
    
    println("Before sorting:")
    for (score in scores) {
        print("${score} ")
    }
    println()
    
    // Sort
    sortAscending(scores)
    
    println("After sorting (ascending):")
    for (score in scores) {
        print("${score} ")
    }
    println()
    
    return 0
}
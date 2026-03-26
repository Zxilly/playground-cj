// Return a tuple: returning both minimum and maximum values
func minMax(arr: Array<Int64>): (Int64, Int64) {
    var minVal = arr[0]
    var maxVal = arr[0]
    
    for (v in arr) {
        if (v < minVal) {
            minVal = v
        }
        if (v > maxVal) {
            maxVal = v
        }
    }
    
    (minVal, maxVal)  // Implicitly return the tuple
}

// Return a tuple with names (only for documentation, not for access)
func getPerson(): (name: String, age: Int64) {
    ("Zhang San", 30)
}

main() {
    let numbers = [5, 2, 8, 1, 9, 3, 7]
    
    // Method 1: Access tuple elements via index
    let result1 = minMax(numbers)
    println("Minimum: ${result1[0]}, Maximum: ${result1[1]}")
    
    // Method 2: Use destructuring to extract into independent variables
    let (minVal, maxVal) = minMax(numbers)
    println("Range: ${minVal} to ${maxVal}")
    
    // Can use _ to ignore unneeded values during destructuring
    let (_, max) = minMax(numbers)
    println("Only care about maximum: ${max}")
    
    // Tuple with names
    let person = getPerson()
    println("Name: ${person[0]}, Age: ${person[1]}")
}
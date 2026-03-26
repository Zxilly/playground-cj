// Nested functions: functions defined inside functions

func processNumbers(numbers: Array<Int64>): (Int64, Int64, Int64) {
    // Nested function: calculate sum
    func sum(arr: Array<Int64>): Int64 {
        var total = 0
        for (n in arr) {
            total += n
        }
        total
    }
    
    // Nested function: calculate average
    func average(arr: Array<Int64>): Int64 {
        if (arr.size == 0) {
            0
        } else {
            sum(arr) / arr.size
        }
    }
    
    // Nested function: find maximum value
    func max(arr: Array<Int64>): Int64 {
        if (arr.size == 0) {
            0
        } else {
            var maxVal = arr[0]
            for (n in arr) {
                if (n > maxVal) {
                    maxVal = n
                }
            }
            maxVal
        }
    }
    
    // Nested functions can call each other
    (sum(numbers), average(numbers), max(numbers))
}

func makeCounter(): () -> Int64 {
    var count = 0
    
    // Nested function can capture outer variable
    func increment(): Int64 {
        count = count + 1
        count
    }
    
    increment
}

main() {
    let data = [10, 20, 30, 40, 50]
    let (total, avg, maximum) = processNumbers(data)
    
    println("Data: ${data}")
    println("Sum: ${total}")
    println("Average: ${avg}")
    println("Maximum: ${maximum}")
    
    // Nested function returned as closure
    let counter = makeCounter()
    println("Count: ${counter()}")  // 1
    println("Count: ${counter()}")  // 2
    println("Count: ${counter()}")  // 3
}
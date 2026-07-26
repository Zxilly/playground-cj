// Nested functions: functions defined inside functions

class CounterState {
    var count: Int64

    init(count: Int64) {
        this.count = count
    }
}

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
    let state = CounterState(0)
    
    // The nested function captures an immutable reference whose object is mutable
    func increment(): Int64 {
        state.count = state.count + 1
        state.count
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

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
    (minVal, maxVal)
}

main() {
    let numbers = [3, 1, 4, 1, 5, 9, 2, 6]
    let result = minMax(numbers)
    println("Min: ${result[0]}, Max: ${result[1]}")

    let (lo, hi) = minMax(numbers)
    println("Lo: ${lo}, Hi: ${hi}")
}
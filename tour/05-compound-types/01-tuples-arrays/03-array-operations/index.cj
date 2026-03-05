main() {
    // Mutable array
    var items = ArrayList<Int64>()
    items.append(10)
    items.append(20)
    items.append(30)
    println("Items: ${items}")
    println("Size: ${items.size}")

    // Modify element
    items[1] = 25
    println("After modify: ${items}")

    // Array slicing
    let arr = [1, 2, 3, 4, 5]
    let slice = arr[1..4]
    println("Slice [1..4]: ${slice}")

    // Iterating with index
    for (i in 0..arr.size) {
        println("arr[${i}] = ${arr[i]}")
    }
}
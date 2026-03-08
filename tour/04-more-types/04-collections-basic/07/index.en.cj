import std.collection.ArrayList

func sortAscending(values: ArrayList<Int64>): Unit {
    var i = 0
    while (i < values.size) {
        var smallest = i
        var j = i + 1
        while (j < values.size) {
            if (values[j] < values[smallest]) {
                smallest = j
            }
            j += 1
        }

        if (smallest != i) {
            let tmp = values[i]
            values[i] = values[smallest]
            values[smallest] = tmp
        }
        i += 1
    }
}

main(): Int64 {
    let scores = ArrayList<Int64>([42, 7, 19, 7, 88])
    sortAscending(scores)

    for (score in scores) {
        println(score)
    }
    return 0
}

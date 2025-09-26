package playground

// Split string with given separators, supporting multiple separators
import std.collection.*

// Regular implementation
func split_normal(text: String, sep: String): ArrayList<String> {
    let indices = ArrayList<Int64>()
    var last = true
    for (i in 0..text.size) {
        let current = sep.indexOf(text[i]).isSome()
        if (last != current) {
            indices.add(i)
        }
        last = current
    }
    if (!last) {
        indices.add(text.size)
    }

    let result = ArrayList<String>()
    for (i in 0..indices.size : 2) {
        result.add(text[indices[i]..indices[i + 1]])
    }
    return result
}

// Functional programming implementation
func split(text: String, sep: String): ArrayList<String> {
    let indices = ArrayList<Int64>()
    text |> enumerate |>
        fold(false) {
        state, e =>
        let current = sep.indexOf(e[1]).isNone()
        if (state != current) {
            indices.add(e[0])
        }
        current
    } |> {
        valid: Bool => if (valid) {
            indices.add(text.size)
        }
    }

    let result = ArrayList<String>()
    for (i in 0..indices.size : 2) {
        result.add(text[indices[i]..indices[i + 1]])
    }
    return result
}

main() {
    let text = "123, 456 7&89, , 96^3, 567"
    let separator = "&^, "
    println(split_normal(text, separator))
    println(split(text, separator))
}
import std.collection.*

type NameList = ArrayList<String>

type ScoreMap = HashMap<String, Int64>

main() {
    let names = NameList()
    names.add("Alice")
    names.add("Bob")

    let scores = ScoreMap()
    scores.add("Alice", 95)
    scores.add("Bob", 87)

    println(names.size)
    println(scores["Alice"])
}

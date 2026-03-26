import std.collection.*

// 为复杂泛型类型定义简短别名
type NameList = ArrayList<String>

// 映射类型的别名
type ScoreMap = HashMap<String, Int64>

// 也可以定义跨项目的复杂类型别名
type Configuration = HashMap<String, String>

// 泛型类型别名（定义时需要保留泛型参数）
type RecordList<T> = ArrayList<T>

main() {
    // 使用别名创建实例，更具可读性
    let names = NameList()
    names.add("张三")
    names.add("李四")
    names.add("王五")

    println("学生名单 (${names.size} 人):")
    for (name in names) {
        println("  - ${name}")
    }

    // 使用别名创建分数映射
    let scores = ScoreMap()
    scores.add("张三", 95)
    scores.add("李四", 87)
    scores.add("王五", 92)

    println("\n成绩单:")
    println("  张三: ${scores["张三"]} 分")
    println("  李四: ${scores["李四"]} 分")
    println("  王五: ${scores["王五"]} 分")

    // 使用泛型别名
    let records = RecordList<Int64>()
    records.add(100)
    records.add(200)
    println("\n记录数: ${records.size}")
}
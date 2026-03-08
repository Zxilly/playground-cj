// 在真正的多包项目中，你可以写：
//
//   // 在 mylib 包中：
//   public import std.collection.ArrayList
//
// 然后 mylib 的使用者无需导入 std.collection 即可使用 ArrayList。

import std.collection.ArrayList

main(): Unit {
    let items = ArrayList<Int64>()
    items.append(10)
    items.append(20)
    items.append(30)
    println("Re-exported collections: ${items}")
}

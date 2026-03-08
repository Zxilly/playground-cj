// In a real multi-package project, you would write:
//
//   // In package mylib:
//   public import std.collection.ArrayList
//
// Then users of mylib get ArrayList without importing std.collection.

import std.collection.ArrayList

main(): Unit {
    let items = ArrayList<Int64>()
    items.append(10)
    items.append(20)
    items.append(30)
    println("Re-exported collections: ${items}")
}

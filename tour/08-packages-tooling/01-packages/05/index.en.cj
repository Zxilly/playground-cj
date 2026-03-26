// In a real multi-package project, you can re-export declarations from other packages:
//
//   // In the mylib package:
//   package mylib
//   public import std.collection.ArrayList
//   public import std.math.sqrt
//
// Then code importing mylib can use ArrayList and sqrt directly,
// without separately importing std.collection or std.math
//
// This is called "re-export", used to build friendly library APIs

import std.collection.ArrayList

// Regular private import (default)
// Imported names are only available in the current file

main(): Unit {
    let numbers = ArrayList<Int64>()
    numbers.append(100)
    numbers.append(200)
    numbers.append(300)
    
    println("Re-export demonstration:")
    println("Count: ${numbers.size}")
    
    for (num in numbers) {
        println("  Element: ${num}")
    }
    
    println("\nUse cases for re-exports:")
    println("1. Library authors can aggregate common types from multiple subpackages")
    println("2. Users only need to import a single entry package")
    println("3. Internal package structure can be refactored without breaking APIs")
}
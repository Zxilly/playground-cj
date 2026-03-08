// Package declaration must match the directory path.
// For a file in src/myapp/, use: package myapp
// Files in src/ root can omit the declaration.

// This file is in the root, so no package declaration needed.

func greet(): String {
    "Hello from the default package!"
}

main(): Unit {
    println(greet())
}

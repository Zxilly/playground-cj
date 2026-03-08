// This program works on both CJNative and CJVM backends.
// Compile with CJNative SDK:  cjc main.cj -o main
// Compile with CJVM SDK:      cjc main.cj -o main

main() {
    println("Hello from Cangjie!")
    println("This code is backend-agnostic.")
    println("It runs on both CJNative and CJVM.")
}

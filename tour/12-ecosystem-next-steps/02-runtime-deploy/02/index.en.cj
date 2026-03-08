// Default build (dynamic linking):
//   cjc main.cj -o main
//   export LD_LIBRARY_PATH=$CANGJIE_HOME/runtime/lib/linux_x86_64_cjnative
//   ./main
//
// Static build (self-contained):
//   cjc main.cj -o main --static

main() {
    println("Cangjie runtime deployment check: OK")
    println("This binary is ready to run.")
}

func myIf(flag: Bool, onTrue: () -> Int64) {
    if (flag) {
        onTrue()
    } else {
        0
    }
}

func applyTwice(action: (Int64) -> Int64) {
    action(action(2))
}

main() {
    println(myIf(true) {
        100
    })

    println(applyTwice {
        value => value + 3
    })
}

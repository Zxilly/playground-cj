private func secretHelper(): String {
    "only visible in this file"
}

// internal is the default — visible in this package
func packageGreet(): String {
    "visible in package and subpackages"
}

public func publicGreet(): String {
    "visible everywhere"
}

main(): Unit {
    println(secretHelper())
    println(packageGreet())
    println(publicGreet())
}

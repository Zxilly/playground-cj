private func secretHelper(): String {
    "only visible in this file"
}

// internal 是默认值——在本包内可见
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

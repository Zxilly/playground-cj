import std.reflect.TypeInfo

// Custom annotation with parameters
@Annotation
public class Version {
    let code: String
    const init(code: String) {
        this.code = code
    }
}

// Custom parameterless annotation
@Annotation
public class Deprecated {
    const init() {}
}

// Using annotation with parameters
@Version["1.0"]
class ServiceA {}

// Using parameterless annotation (both forms are acceptable)
@Deprecated
class ServiceB {}

main() {
    // Get the Version annotation of ServiceA
    let versionA = TypeInfo.of(ServiceA()).findAnnotation<Version>()
    if (let Some(ann) <- versionA) {
        println("ServiceA version: ${ann.code}")
    }
    
    // Check if ServiceB has the Deprecated annotation
    let deprecatedB = TypeInfo.of(ServiceB()).findAnnotation<Deprecated>()
    if (deprecatedB.isSome()) {
        println("ServiceB is deprecated")
    }
    
    // Check if ServiceA has the Deprecated annotation
    let deprecatedA = TypeInfo.of(ServiceA()).findAnnotation<Deprecated>()
    if (deprecatedA.isNone()) {
        println("ServiceA is not deprecated")
    }
}
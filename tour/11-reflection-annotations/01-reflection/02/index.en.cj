import std.reflect.*

// Define version number annotation
@Annotation
public class Version {
    let code: String
    
    const init(code: String) {
        this.code = code
    }
}

// Apply annotation to classes
@Version["1.0"]
class ApiV1 {
    public func call(): String {
        "API Version 1.0"
    }
}

@Version["2.0"]
class ApiV2 {
    public func call(): String {
        "API Version 2.0"
    }
}

main() {
    // Create API objects of different versions
    let objects = [ApiV1() as Object, ApiV2() as Object]
    
    println("Checking API version information:")
    println()
    
    for (obj in objects) {
        // Get type information of the object
        let typeInfo = TypeInfo.of(obj)
        
        // Find Version annotation
        let annOpt = typeInfo.findAnnotation<Version>()
        
        if (let Some(ann) <- annOpt) {
            println("  ${typeInfo.name}: version ${ann.code}")
        } else {
            println("  ${typeInfo.name}: no version information")
        }
    }
}
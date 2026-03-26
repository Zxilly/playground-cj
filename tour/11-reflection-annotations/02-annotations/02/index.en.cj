import std.reflect.TypeInfo

// Custom author annotation
@Annotation
public class Author {
    let name: String
    let email: String
    const init(name: String, email: String) {
        this.name = name
        this.email = email
    }
}

// Apply annotation to different classes
@Author["Zhang San", "zhangsan@example.com"]
class ServiceLoader {}

@Author["Li Si", "lisi@example.com"]
class DataProcessor {}

class PluginA {}  // No annotation

main() {
    let components = [ServiceLoader(), DataProcessor(), PluginA()]
    
    for (comp in components) {
        let typeInfo = TypeInfo.of(comp)
        let typeName = typeInfo.name
        let authorOpt = typeInfo.findAnnotation<Author>()
        
        if (let Some(author) <- authorOpt) {
            println("${typeName}:")
            println("  Author: ${author.name}")
            println("  Email: ${author.email}")
        } else {
            println("${typeName}: No author information")
        }
    }
}
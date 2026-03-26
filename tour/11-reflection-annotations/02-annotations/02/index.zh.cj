import std.reflect.TypeInfo

// 自定义作者注解
@Annotation
public class Author {
    let name: String
    let email: String
    const init(name: String, email: String) {
        this.name = name
        this.email = email
    }
}

// 应用注解到不同的类
@Author["张三", "zhangsan@example.com"]
class ServiceLoader {}

@Author["李四", "lisi@example.com"]
class DataProcessor {}

class PluginA {}  // 没有注解

main() {
    let components = [ServiceLoader(), DataProcessor(), PluginA()]
    
    for (comp in components) {
        let typeInfo = TypeInfo.of(comp)
        let typeName = typeInfo.name
        let authorOpt = typeInfo.findAnnotation<Author>()
        
        if (let Some(author) <- authorOpt) {
            println("${typeName}:")
            println("  作者: ${author.name}")
            println("  邮箱: ${author.email}")
        } else {
            println("${typeName}: 无作者信息")
        }
    }
}
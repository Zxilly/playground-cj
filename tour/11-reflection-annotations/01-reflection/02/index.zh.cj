import std.reflect.*

// 定义版本号注解
@Annotation
public class Version {
    let code: String
    
    const init(code: String) {
        this.code = code
    }
}

// 应用注解到类
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
    // 创建不同版本的 API 对象
    let objects = [ApiV1() as Object, ApiV2() as Object]
    
    println("检查 API 版本信息:")
    println()
    
    for (obj in objects) {
        // 获取对象的类型信息
        let typeInfo = TypeInfo.of(obj)
        
        // 查找 Version 注解
        let annOpt = typeInfo.findAnnotation<Version>()
        
        if (let Some(ann) <- annOpt) {
            println("  ${typeInfo.name}: 版本 ${ann.code}")
        } else {
            println("  ${typeInfo.name}: 无版本信息")
        }
    }
}
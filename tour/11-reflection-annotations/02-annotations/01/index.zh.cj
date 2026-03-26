import std.reflect.TypeInfo

// 带参数的自定义注解
@Annotation
public class Version {
    let code: String
    const init(code: String) {
        this.code = code
    }
}

// 无参自定义注解
@Annotation
public class Deprecated {
    const init() {}
}

// 使用带参数的注解
@Version["1.0"]
class ServiceA {}

// 使用无参注解（两种写法均可）
@Deprecated
class ServiceB {}

main() {
    // 获取 ServiceA 的 Version 注解
    let versionA = TypeInfo.of(ServiceA()).findAnnotation<Version>()
    if (let Some(ann) <- versionA) {
        println("ServiceA 版本: ${ann.code}")
    }
    
    // 检查 ServiceB 是否有 Deprecated 注解
    let deprecatedB = TypeInfo.of(ServiceB()).findAnnotation<Deprecated>()
    if (deprecatedB.isSome()) {
        println("ServiceB 已废弃")
    }
    
    // 检查 ServiceA 是否有 Deprecated 注解
    let deprecatedA = TypeInfo.of(ServiceA()).findAnnotation<Deprecated>()
    if (deprecatedA.isNone()) {
        println("ServiceA 未废弃")
    }
}
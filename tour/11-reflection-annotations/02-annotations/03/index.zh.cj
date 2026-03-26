import std.reflect.TypeInfo

// 只能用于成员函数的注解
@Annotation[target: [MemberFunction]]
public class Log {
    let level: String
    const init(level: String) {
        this.level = level
    }
}

// 只能用于类型声明的注解
@Annotation[target: [Type]]
public class Entity {
    let tableName: String
    const init(tableName: String) {
        this.tableName = tableName
    }
}

// 正确用法：@Entity 用在类上
@Entity["users"]
class User {
    public let id: Int64
    public let name: String
    
    public init(id: Int64, name: String) {
        this.id = id
        this.name = name
    }
    
    // 正确用法：@Log 用在成员函数上
    @Log["info"]
    public func display(): Unit {
        println("User(${id}, ${name})")
    }
    
    @Log["debug"]
    public func save(): Unit {
        println("保存用户到数据库")
    }
}

main() {
    let user = User(1, "张三")
    
    // 通过反射获取类的 Entity 注解
    let entityOpt = TypeInfo.of(user).findAnnotation<Entity>()
    if (let Some(entity) <- entityOpt) {
        println("实体表名: ${entity.tableName}")
    }
    
    // 调用带注解的方法
    user.display()
    user.save()
}
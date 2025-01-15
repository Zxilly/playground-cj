import array from '@/examples/array.cj'
import classBTree from '@/examples/class-btree.cj'
import cube from '@/examples/cube.cj'
import enumBTree from '@/examples/enum-btree.cj'
import enumExpr from '@/examples/enum-expr.cj'
import extend from '@/examples/extend.cj'
import _for from '@/examples/for.cj'
import functionBTree from '@/examples/function-btree.cj'
import functional from '@/examples/functional.cj'
import genericBTree from '@/examples/generic-btree.cj'
import helloWorld from '@/examples/hello-world.cj'
import lambda from '@/examples/lambda.cj'
import optionParse from '@/examples/option-parse.cj'
import propBTree from '@/examples/prop-btree.cj'
import structBTree from '@/examples/struct-btree.cj'
import thread from '@/examples/thread.cj'
import variables from '@/examples/variables.cj'

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://cj-api.learningman.top'
export const WS_BACKEND_URL = `${BACKEND_URL.replace('http', 'ws')}/ws`

export const EXAMPLES = {
  'hello-world': helloWorld,
  '数组': array,
  '循环': _for,
  '扩展': extend,
  'Lambda': lambda,
  'Option': optionParse,
  '变量': variables,
  '线程': thread,
  '二叉树（类实现）': classBTree,
  '二叉树（枚举实现）': enumBTree,
  '二叉树（函数实现）': functionBTree,
  '二叉树（泛型实现）': genericBTree,
  '二叉树（属性实现）': propBTree,
  '二叉树（结构体实现）': structBTree,
  '枚举表达式': enumExpr,
  '函数式': functional,
  '魔方': cube,
}

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
import cffi from '@/examples/cffi.cj'

// English versions
import helloWorldEn from '@/examples/hello-world.en.cj'
import variablesEn from '@/examples/variables.en.cj'
import arrayEn from '@/examples/array.en.cj'
import forEn from '@/examples/for.en.cj'
import extendEn from '@/examples/extend.en.cj'
import lambdaEn from '@/examples/lambda.en.cj'
import optionParseEn from '@/examples/option-parse.en.cj'
import threadEn from '@/examples/thread.en.cj'
import classBTreeEn from '@/examples/class-btree.en.cj'
import enumBTreeEn from '@/examples/enum-btree.en.cj'
import functionBTreeEn from '@/examples/function-btree.en.cj'
import genericBTreeEn from '@/examples/generic-btree.en.cj'
import propBTreeEn from '@/examples/prop-btree.en.cj'
import structBTreeEn from '@/examples/struct-btree.en.cj'
import enumExprEn from '@/examples/enum-expr.en.cj'
import functionalEn from '@/examples/functional.en.cj'
import cubeEn from '@/examples/cube.en.cj'
import cffiEn from '@/examples/cffi.en.cj'

import { i18n } from '@lingui/core'

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://cj-api.learningman.top'
export const WS_BACKEND_URL = `${BACKEND_URL.replace('http', 'ws')}/ws`

export const examples: [string, { zh: { name: string, content: string }, en: { name: string, content: string } }][] = [
  ['hello-world', { zh: { name: 'Hello World', content: helloWorld }, en: { name: 'Hello World', content: helloWorldEn } }],
  ['array', { zh: { name: '数组', content: array }, en: { name: 'Array', content: arrayEn } }],
  ['for', { zh: { name: '循环', content: _for }, en: { name: 'For Loop', content: forEn } }],
  ['extend', { zh: { name: '扩展', content: extend }, en: { name: 'Extend', content: extendEn } }],
  ['lambda', { zh: { name: 'Lambda', content: lambda }, en: { name: 'Lambda', content: lambdaEn } }],
  ['option', { zh: { name: 'Option', content: optionParse }, en: { name: 'Option', content: optionParseEn } }],
  ['variables', { zh: { name: '变量', content: variables }, en: { name: 'Variables', content: variablesEn } }],
  ['thread', { zh: { name: '线程', content: thread }, en: { name: 'Thread', content: threadEn } }],
  ['class-btree', { zh: { name: '二叉树（类实现）', content: classBTree }, en: { name: 'Binary Tree (Class)', content: classBTreeEn } }],
  ['enum-btree', { zh: { name: '二叉树（枚举实现）', content: enumBTree }, en: { name: 'Binary Tree (Enum)', content: enumBTreeEn } }],
  ['function-btree', { zh: { name: '二叉树（函数实现）', content: functionBTree }, en: { name: 'Binary Tree (Function)', content: functionBTreeEn } }],
  ['generic-btree', { zh: { name: '二叉树（泛型实现）', content: genericBTree }, en: { name: 'Binary Tree (Generic)', content: genericBTreeEn } }],
  ['prop-btree', { zh: { name: '二叉树（属性实现）', content: propBTree }, en: { name: 'Binary Tree (Property)', content: propBTreeEn } }],
  ['struct-btree', { zh: { name: '二叉树（结构体实现）', content: structBTree }, en: { name: 'Binary Tree (Struct)', content: structBTreeEn } }],
  ['enum-expr', { zh: { name: '枚举表达式', content: enumExpr }, en: { name: 'Enum Expression', content: enumExprEn } }],
  ['functional', { zh: { name: '函数式', content: functional }, en: { name: 'Functional', content: functionalEn } }],
  ['cube', { zh: { name: '魔方', content: cube }, en: { name: 'Cube', content: cubeEn } }],
  ['cffi', { zh: { name: 'CFFI', content: cffi }, en: { name: 'CFFI', content: cffiEn } }],
]

export function getLocalizedExamples() {
  const currentLocale = i18n.locale || 'zh'

  return Object.fromEntries(
    examples.map(([, { zh, en }]) => {
      const { name, content } = currentLocale === 'en' ? en : zh
      return [name, content]
    }),
  )
}

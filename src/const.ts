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

// Define example content mapping for different languages
export const EXAMPLE_CONTENT_ZH = {
  'hello-world': helloWorld,
  'array': array,
  'for': _for,
  'extend': extend,
  'lambda': lambda,
  'option': optionParse,
  'variables': variables,
  'thread': thread,
  'class-btree': classBTree,
  'enum-btree': enumBTree,
  'function-btree': functionBTree,
  'generic-btree': genericBTree,
  'prop-btree': propBTree,
  'struct-btree': structBTree,
  'enum-expr': enumExpr,
  'functional': functional,
  'cube': cube,
  'cffi': cffi,
}

export const EXAMPLE_CONTENT_EN = {
  'hello-world': helloWorldEn,
  'array': arrayEn,
  'for': forEn,
  'extend': extendEn,
  'lambda': lambdaEn,
  'option': optionParseEn,
  'variables': variablesEn,
  'thread': threadEn,
  'class-btree': classBTreeEn,
  'enum-btree': enumBTreeEn,
  'function-btree': functionBTreeEn,
  'generic-btree': genericBTreeEn,
  'prop-btree': propBTreeEn,
  'struct-btree': structBTreeEn,
  'enum-expr': enumExprEn,
  'functional': functionalEn,
  'cube': cubeEn,
  'cffi': cffiEn,
}

// Define example names mapping - these will be translated dynamically
export const EXAMPLE_NAME_KEYS = {
  'hello-world': 'Hello World', // This remains in English
  'array': '数组',
  'for': '循环',
  'extend': '扩展',
  'lambda': 'Lambda', // This remains in English
  'option': 'Option', // This remains in English
  'variables': '变量',
  'thread': '线程',
  'class-btree': '二叉树（类实现）',
  'enum-btree': '二叉树（枚举实现）',
  'function-btree': '二叉树（函数实现）',
  'generic-btree': '二叉树（泛型实现）',
  'prop-btree': '二叉树（属性实现）',
  'struct-btree': '二叉树（结构体实现）',
  'enum-expr': '枚举表达式',
  'functional': '函数式',
  'cube': '魔方',
  'cffi': 'CFFI', // This remains in English
} as const

// Generate localized examples object
export function getLocalizedExamples() {
  const currentLocale = i18n.locale || 'zh'
  const exampleContent = currentLocale === 'en' ? EXAMPLE_CONTENT_EN : EXAMPLE_CONTENT_ZH

  const examples: Record<string, string> = {}
  Object.keys(exampleContent).forEach(key => {
    const nameKey = EXAMPLE_NAME_KEYS[key as keyof typeof EXAMPLE_NAME_KEYS]
    // For English locale, translate Chinese names to English
    let displayName: string = nameKey
    if (currentLocale === 'en') {
      const translations: Record<string, string> = {
        '数组': 'Array',
        '循环': 'Loop',
        '扩展': 'Extension',
        '变量': 'Variables',
        '线程': 'Thread',
        '二叉树（类实现）': 'Binary Tree (Class Implementation)',
        '二叉树（枚举实现）': 'Binary Tree (Enum Implementation)',
        '二叉树（函数实现）': 'Binary Tree (Function Implementation)',
        '二叉树（泛型实现）': 'Binary Tree (Generic Implementation)',
        '二叉树（属性实现）': 'Binary Tree (Property Implementation)',
        '二叉树（结构体实现）': 'Binary Tree (Struct Implementation)',
        '枚举表达式': 'Enum Expression',
        '函数式': 'Functional',
        '魔方': 'Cube',
      }
      displayName = translations[nameKey] || nameKey
    }
    examples[displayName] = exampleContent[key as keyof typeof exampleContent]
  })
  return examples
}

// Keep the old EXAMPLES for backward compatibility during transition
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
  'CFFI': cffi,
}

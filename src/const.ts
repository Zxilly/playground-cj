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
import { t } from '@lingui/core/macro'

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

// Define example names mapping - store translation templates
const EXAMPLE_NAME_KEYS = {
  'hello-world': 'Hello World',
  'array': t`数组`,
  'for': t`循环`,
  'extend': t`扩展`,
  'lambda': 'Lambda',
  'option': 'Option',
  'variables': t`变量`,
  'thread': t`线程`,
  'class-btree': t`二叉树（类实现）`,
  'enum-btree': t`二叉树（枚举实现）`,
  'function-btree': t`二叉树（函数实现）`,
  'generic-btree': t`二叉树（泛型实现）`,
  'prop-btree': t`二叉树（属性实现）`,
  'struct-btree': t`二叉树（结构体实现）`,
  'enum-expr': t`枚举表达式`,
  'functional': t`函数式`,
  'cube': t`魔方`,
  'cffi': 'CFFI',
} as const

// Generate localized examples object
export function getLocalizedExamples() {
  const currentLocale = i18n.locale || 'zh'
  const exampleContent = currentLocale === 'en' ? EXAMPLE_CONTENT_EN : EXAMPLE_CONTENT_ZH

  return Object.fromEntries(
    Object.entries(exampleContent).map(([key, content]) => {
      const nameTemplate = EXAMPLE_NAME_KEYS[key as keyof typeof EXAMPLE_NAME_KEYS]
      const translatedName = typeof nameTemplate === 'string' ? nameTemplate : i18n._(nameTemplate)
      return [translatedName, content]
    }),
  )
}

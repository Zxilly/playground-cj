import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflowDirectory = resolve(process.cwd(), '.github', 'workflows')

function readWorkflow(name: string): string {
  return readFileSync(join(workflowDirectory, name), 'utf8')
}

describe('github Actions supply-chain boundary', () => {
  it('pins every external action to an immutable full commit SHA', () => {
    for (const name of readdirSync(workflowDirectory)) {
      if (!/\.ya?ml$/.test(name))
        continue
      const workflow = readWorkflow(name)
      const uses = [...workflow.matchAll(/^\s*-\s+uses:\s+(\S+)/gm)]
        .map(match => match[1])
      expect(uses.length, `${name} should contain inspected actions`).toBeGreaterThan(0)
      for (const action of uses)
        expect(action, `${name}: ${action}`).toMatch(/^[^@\s]+@[0-9a-f]{40}$/)
    }
  })

  it('gives the test workflow only read access to repository contents', () => {
    const workflow = readWorkflow('test.yml')
    expect(workflow).toMatch(
      /^permissions:\r?\n\s+contents:\s+read\s*$/m,
    )
  })

  it('deploys runner images only from master after smoking the exact local image', () => {
    const workflow = readWorkflow('deploy-runner.yml')
    expect(workflow).toMatch(/push:\r?\n\s+branches:\s+\[master\]/)
    expect(workflow).toContain('if: github.ref == \'refs/heads/master\'')
    expect(workflow).toContain('load: true')
    expect(workflow).toContain('push: false')

    const smoke = workflow.indexOf('name: Smoke exact candidate image')
    const login = workflow.indexOf('name: Log in to GHCR')
    const push = workflow.indexOf('docker push')
    expect(smoke).toBeGreaterThan(0)
    expect(login).toBeGreaterThan(smoke)
    expect(push).toBeGreaterThan(login)
  })
})

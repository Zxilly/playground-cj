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

  it('deploys the runner only to Modal from master', () => {
    const workflow = readWorkflow('deploy-runner.yml')
    expect(workflow).toMatch(/push:\r?\n\s+branches:\s+\[master\]/)
    expect(workflow).toContain('if: github.ref == \'refs/heads/master\'')
    expect(workflow).toMatch(/^permissions:\r?\n\s+contents:\s+read\s*$/m)
    expect(workflow).toContain('MODAL_TOKEN_ID: ${{ secrets.MODAL_TOKEN_ID }}')
    expect(workflow).toContain('MODAL_TOKEN_SECRET: ${{ secrets.MODAL_TOKEN_SECRET }}')
    expect(workflow).toContain('modal run modal/build_runner_image.py')
    expect(workflow).toContain('modal deploy modal/runner.py')
    expect(workflow).not.toContain('GHCR')
    expect(workflow).not.toContain('docker push')
  })
})

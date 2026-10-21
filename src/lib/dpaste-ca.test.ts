// @vitest-environment node

import { X509Certificate } from 'node:crypto'
import { rootCertificates } from 'node:tls'
import { expect, it } from 'vitest'
import { DPASTE_CHAIN_CERTIFICATE } from './dpaste-ca'

it('completes the paste service chain through an existing trusted root', () => {
  const certificate = new X509Certificate(DPASTE_CHAIN_CERTIFICATE)
  const issuer = rootCertificates.map(pem => new X509Certificate(pem))
    .find(root => root.subject === certificate.issuer)

  expect(certificate.ca).toBe(true)
  expect(certificate.issuer).toContain('CN=ISRG Root X1')
  expect(issuer && certificate.verify(issuer.publicKey)).toBe(true)
  expect(Date.parse(certificate.validTo)).toBeGreaterThan(Date.now())
})

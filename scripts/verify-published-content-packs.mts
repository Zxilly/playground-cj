import {
  getContentPackReferenceValidations,
} from '../src/lib/teach/classroom/content-pack-generation'
import {
  currentContentPackValidationReceiptSchema,
} from '../src/lib/teach/classroom/content-pack-artifact'
import {
  readCheckedInValidationReceipt,
  verifyContentPackPublication,
} from './content-pack-verification.mts'

async function main(): Promise<void> {
  const receipt = currentContentPackValidationReceiptSchema.parse(
    readCheckedInValidationReceipt(),
  )
  const count = await verifyContentPackPublication({
    compiler: receipt.compiler,
    codeSamples: receipt.codeSamples,
    templates: getContentPackReferenceValidations(),
  })
  console.log(
    `Verified ${count.templates} receipt-bound Content Pack reference/starter pairs, `
    + `${count.codeSamples} receipt-bound runnable code samples, `
    + 'and the repository-local publication integrity log.',
  )
}

void main()

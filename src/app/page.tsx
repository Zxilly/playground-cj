import 'server-only'
import Wrapper from '@/components/Wrapper'

async function getShareCode(hash?: string) {
  if (hash) {
    const response = await fetch(`https://dpaste.com/${hash}.txt`)
    if (response.ok) {
      return await response.text()
    }
  }
  return undefined
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [_: string]: string | string[] | undefined }>
}) {
  let code: string | undefined = undefined
  let sp = await searchParams
  if (sp.hash) {
    code = await getShareCode(sp.hash as string)
  }

  return (
    <main>
      <Wrapper defaultCode={code} />
    </main>
  )
}

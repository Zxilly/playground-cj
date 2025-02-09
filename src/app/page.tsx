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
  const code = await getShareCode((await searchParams).hash as string)

  return (
    <main>
      <Wrapper defaultCode={code} />
    </main>
  )
}

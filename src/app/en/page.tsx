import Wrapper from '@/components/Wrapper'
import { getShareCode } from '@/service/share'

export default async function EnglishPage({
  searchParams,
}: {
  searchParams: Promise<{ [_: string]: string | string[] | undefined }>
}) {
  let code: string | undefined
  const sp = await searchParams
  if (sp.hash) {
    code = await getShareCode(sp.hash as string)
  }

  return (
    <main>
      <Wrapper defaultCode={code} />
    </main>
  )
}
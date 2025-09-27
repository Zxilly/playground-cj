import Wrapper from '@/components/Wrapper'
import { getShareCode } from '@/service/share'

interface PageProps {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ [_: string]: string | string[] | undefined }>
}

export default async function LangPage({ params, searchParams }: PageProps) {
  const { lang } = await params
  const sp = await searchParams

  let code: string | undefined
  if (sp.hash) {
    code = await getShareCode(sp.hash as string)
  }
  return (
    <main>
      <Wrapper lang={lang} defaultCode={code} />
    </main>
  )
}

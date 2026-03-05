import Wrapper from '@/components/Wrapper'
import { getShareCode } from '@/service/share'

interface PageProps {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LangPage({ params, searchParams }: PageProps) {
  const { lang } = await params
  const { hash } = await searchParams

  const code = hash ? await getShareCode(hash as string) : undefined

  return (
    <main>
      <Wrapper lang={lang} defaultCode={code} />
    </main>
  )
}

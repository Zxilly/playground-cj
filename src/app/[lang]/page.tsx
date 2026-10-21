import Wrapper from '@/features/playground/components/PlaygroundWrapper'
import { getShareCode } from '@/lib/dpaste-server'

interface PageProps {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LangPage({ params, searchParams }: PageProps) {
  const { lang } = await params
  const { hash } = await searchParams

  const code = typeof hash === 'string' ? await getShareCode(hash) : undefined

  return (
    <main>
      <Wrapper lang={lang} defaultCode={code} />
    </main>
  )
}

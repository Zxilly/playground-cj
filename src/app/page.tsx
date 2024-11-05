'use client'

import dynamic from 'next/dynamic'

const Playground = dynamic(() => import('@/components/Playground'), { ssr: false })

export default function Home() {
  return (
    <main>
      <Playground />
    </main>
  )
}

import Script from 'next/script'

function TrackingScript() {
  if (process.env.NODE_ENV !== 'production') {
    return null
  }

  return (
    <>
      <Script
        id="track"
        defer
        src="https://trail.learningman.top/script.js"
        data-website-id="2cd9ea13-296b-4d90-998a-bbbc5613fc20"
        crossOrigin="anonymous"
      />
      <Script
        id="cf-beacon"
        defer
        src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": "2622f32f6909497cae2680dad39f4c21"}'
        crossOrigin="anonymous"
      />
    </>
  )
}

export default TrackingScript

import Script from 'next/script'
import React from 'react'

function TrackingScript() {
  return (
    <>
      {process.env.NODE_ENV === 'production' && (
        <Script
          id="track"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var el = document.createElement('script');
                el.setAttribute('src', 'https://trail.learningman.top/script.js');
                el.setAttribute('data-website-id', '2cd9ea13-296b-4d90-998a-bbbc5613fc20');
                document.body.appendChild(el);
              })();
            `,
          }}
        />
      )}
    </>
  )
}

export default TrackingScript

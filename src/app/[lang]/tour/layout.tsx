import './tour.css'
import TrackingScript from '@/modules/analytics/TrackingScript'

export default function TourLayout({ children }: { children: React.ReactNode }) {
  // Playground/Tour links use full-document navigation, keeping each tracker session scoped to one app.
  return (
    <>
      {children}
      <TrackingScript site="tour" />
    </>
  )
}

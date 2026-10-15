import Navbar from './components/Navbar.jsx'
import Hero from './components/Hero.jsx'
import ReconciliationPortal from './components/ReconciliationPortal.jsx'

export default function App() {
  const scrollToPortal = () => {
    const el = document.getElementById('portal')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar onGetStarted={scrollToPortal} />
      <main id="main">
        <Hero onGetStarted={scrollToPortal} />
        <ReconciliationPortal />
      </main>
    </>
  )
}

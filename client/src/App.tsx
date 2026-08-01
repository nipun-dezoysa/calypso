import { useEffect } from 'react'
import SideBar from './components/sidebar/SideBar'
import MainBox from './components/mainbox/MainBox'
import LoginPage from './components/auth/LoginPage'
import UpdateCredentialsPage from './components/auth/UpdateCredentialsPage'
import { useAuthStore } from './stores/AuthStore'

function App() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  // Checking the stored token; a blank screen beats flashing the login form
  // at someone who is already signed in.
  if (status === 'loading') {
    return <div className='bg-zinc-900 h-screen' />
  }

  if (status === 'signed-out') {
    return <LoginPage />
  }

  // Still on the credentials the instance shipped with — nothing else opens
  // until they are replaced.
  if (user?.must_change_credentials) {
    return <UpdateCredentialsPage />
  }

  return (
    <div className='bg-zinc-900 h-screen flex'>
      <SideBar />
      <MainBox />
    </div>
  )
}

export default App

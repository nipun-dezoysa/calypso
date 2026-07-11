import SideBar from './components/sidebar/SideBar'
import MainBox from './components/mainbox/MainBox'

function App() {
  return (
    <div className='bg-zinc-900 h-screen flex'>
      <SideBar />
      <MainBox />
    </div>
  )
}

export default App
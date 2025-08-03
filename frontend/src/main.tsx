import ReactDOM from 'react-dom/client'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>)

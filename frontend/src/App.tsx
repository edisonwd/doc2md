import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import FileProcessor from './pages/FileProcessor';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<FileProcessor />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
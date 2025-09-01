import Home from "./Home";
import Video from "./Video";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
      <Router>
        <Routes>
          <Route path="/"  element={<Home />} />
          <Route path="/:url" element={<Video />} />
        </Routes>
      </Router>
   );
}

export default App;

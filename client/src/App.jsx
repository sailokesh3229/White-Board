import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/HomeStudio.jsx";
import Board from "./pages/BoardStudio.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/board/:boardId" element={<Board />} />
      </Routes>
    </BrowserRouter>
  );
}

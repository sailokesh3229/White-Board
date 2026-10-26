import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/HomeStudio.jsx";
import Board from "./pages/BoardStudio.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import { AuthProvider, AccountGate } from "./lib/auth.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<AuthPage key="login" />} />
        <Route path="/signup" element={<AuthPage key="signup" register />} />
        <Route path="/board/:boardId" element={<AccountGate><Board /></AccountGate>} />
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

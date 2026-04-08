import { Routes, Route, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AnimatePresence } from "framer-motion";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import UploadReport from "./pages/UploadReport";
import ReportDetails from "./pages/ReportDetails";
import BackgroundLayer from "./components/BackgroundLayer";

function App() {
    const location = useLocation();

    return (
        <>
            <BackgroundLayer />
            <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/upload"
                        element={
                            <ProtectedRoute>
                                <UploadReport />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/report/:id"
                        element={
                            <ProtectedRoute>
                                <ReportDetails />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </AnimatePresence>
        </>
    );
}

export default App;

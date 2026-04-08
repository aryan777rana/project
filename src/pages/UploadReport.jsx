import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { storage, databases } from "../lib/appwrite";
import { ID } from "appwrite";
import { motion, AnimatePresence } from "framer-motion";

export default function UploadReport() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef(null);

    const handleDrag = function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = function(e) {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return;

        setLoading(true);
        setError("");

        try {
            const uploadedFile = await storage.createFile("reports_bucket", ID.unique(), file);

            await databases.createDocument("medical_data", "reports", ID.unique(), {
                userId: user.$id,
                fileId: uploadedFile.$id,
                fileName: file.name,
                status: "Pending",
                reportDate: new Date().toISOString(),
                $permissions: [
                    `read("user:${user.$id}")`,
                    `update("user:${user.$id}")`,
                    `delete("user:${user.$id}")`
                ]
            });

            navigate("/");
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const getDragBorderStyle = () => {
        if (dragActive) {
            return "2px dashed var(--primary)";
        }
        return "2px dashed rgba(0,0,0,0.1)";
    };

    const getDragBgStyle = () => {
        if (dragActive) {
            return "rgba(59, 130, 246, 0.05)";
        }
        return "rgba(255, 255, 255, 0.5)";
    };

    return (
        <motion.div 
            className="centered-page"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ width: '100%' }}
        >
            <div className="glass-card" style={{ maxWidth: '600px', width: '100%', padding: '3rem' }}>
                <div className="flex-between" style={{ marginBottom: '2rem' }}>
                    <h1 className="title" style={{ margin: 0 }}>Upload Document</h1>
                    <Link to="/" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', textDecoration: 'none' }}>
                        Cancel
                    </Link>
                </div>

                {error && <div className="text-error">{error}</div>}
                
                <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} onDragEnter={handleDrag}>
                    
                    <motion.div 
                        className="upload-dropzone"
                        style={{
                            border: getDragBorderStyle(),
                            borderRadius: '16px',
                            padding: '4rem 2rem',
                            textAlign: 'center',
                            background: getDragBgStyle(),
                            transition: 'all 0.3s ease',
                            cursor: 'pointer'
                        }}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current.click()}
                        whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.7)' }}
                        whileTap={{ scale: 0.99 }}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".pdf,image/*"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                        
                        <AnimatePresence mode="wait">
                            {file ? (
                                <motion.div 
                                    key="file"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    <div style={{ fontSize: '3rem', margin: '0 auto 1rem' }}>📄</div>
                                    <p style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--primary)' }}>{file.name}</p>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                        Click or drag to replace
                                    </p>
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key="empty"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <div style={{ fontSize: '3rem', margin: '0 auto 1rem' }}>☁️</div>
                                    <p style={{ fontWeight: 600, fontSize: '1.25rem' }}>Drag & Drop to Upload</p>
                                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>or click to browse local files</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Supported: PDF, JPG, PNG
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    <motion.button
                        type="submit"
                        disabled={!file || loading}
                        className="btn btn-primary"
                        whileHover={{ scale: file && !loading ? 1.02 : 1 }}
                        whileTap={{ scale: file && !loading ? 0.98 : 1 }}
                        style={{ padding: '1rem', fontSize: '1.1rem' }}
                    >
                        {loading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <motion.div 
                                    animate={{ rotate: 360 }} 
                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    style={{ width: '1.2rem', height: '1.2rem', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }}
                                />
                                Processing Upload...
                            </div>
                        ) : "Upload & Analyze"}
                    </motion.button>
                </form>
            </div>
        </motion.div>
    );
}

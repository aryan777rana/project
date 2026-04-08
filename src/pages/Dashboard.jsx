import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { databases } from "../lib/appwrite";
import { Query } from "appwrite";
import { motion } from "framer-motion";

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: "spring", stiffness: 300, damping: 24 }
    }
};

export default function Dashboard() {
    const { user, logout } = useAuth();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingReportId, setEditingReportId] = useState(null);
    const [editTitle, setEditTitle] = useState('');

    useEffect(() => {
        if (user) {
            fetchReports();
        }
    }, [user]);

    async function fetchReports() {
        try {
            const result = await databases.listDocuments("medical_data", "reports", [
                Query.equal("userId", user.$id),
                Query.orderDesc("reportDate")
            ]);
            setReports(result.documents);
        } catch (error) {
            console.error("Error fetching reports:", error);
        } finally {
            setLoading(false);
        }
    }

    const handleDelete = async (reportId) => {
        if (!window.confirm('Are you sure you want to delete this document?')) return;
        try {
            await databases.deleteDocument('medical_data', 'reports', reportId);
            setReports((prev) => prev.filter((r) => r.$id !== reportId));
        } catch (err) {
            console.error('Failed to delete document:', err);
        }
    };

    const startEdit = (report) => {
        setEditingReportId(report.$id);
        setEditTitle(report.fileName);
    };

    const saveEdit = async (reportId) => {
        try {
            await databases.updateDocument('medical_data', 'reports', reportId, { fileName: editTitle });
            setReports((prev) =>
                prev.map((r) => (r.$id === reportId ? { ...r, fileName: editTitle } : r))
            );
            setEditingReportId(null);
        } catch (err) {
            console.error('Failed to update title:', err);
        }
    };

    return (
        <motion.div
            className="dashboard-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
        >
            <div className="glass-header" style={{ borderRadius: '20px', marginBottom: '2rem' }}>
                <div>
                    <h1 className="title" style={{ marginBottom: '0.25rem' }}>Medical Reports</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Welcome back, <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{user?.name}</span></p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Link to="/upload" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                            Upload Report
                        </Link>
                    </motion.div>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={logout}
                        className="btn btn-secondary"
                    >
                        Sign Out
                    </motion.button>
                </div>
            </div>

            <div className="glass" style={{ padding: '2rem', borderRadius: '20px' }}>
                <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Your Documents</h2>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            style={{ display: 'inline-block', width: '2rem', height: '2rem', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: '1rem' }}
                        />
                        <p>Loading your timeline...</p>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="empty-state">
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
                        <h3 style={{ marginBottom: '0.5rem' }}>No Reports Found</h3>
                        <p>Upload your first medical document to get started.</p>
                    </div>
                ) : (
                    <motion.div
                        className="grid"
                        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {reports.map((report) => (
                            <motion.div key={report.$id} variants={itemVariants} className="report-card">
                                {/* Left: title + meta */}
                                <div style={{ flex: 1 }}>
                                    {editingReportId === report.$id ? (
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                            <input
                                                type="text"
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                className="form-input"
                                                style={{ padding: '0.5rem 0.75rem', fontSize: '1rem', flex: 1, minWidth: '150px' }}
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => saveEdit(report.$id)}
                                                className="btn btn-primary btn-sm"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingReportId(null)}
                                                className="btn btn-secondary btn-sm"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <Link to={`/report/${report.$id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                            <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{report.fileName}</p>
                                        </Link>
                                    )}
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        <span style={{ fontWeight: 500 }}>Type:</span> {report.reportType || 'Unknown'} &nbsp;&bull;&nbsp;
                                        <span style={{ fontWeight: 500 }}>Date:</span> {report.reportDate ? new Date(report.reportDate).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>

                                {/* Right: badge + actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                                    <span className={`badge ${report.status === 'Completed' ? 'badge-success' : 'badge-warning'}`}>
                                        {report.status}
                                    </span>
                                    <button
                                        onClick={() => startEdit(report)}
                                        className="btn btn-secondary btn-sm"
                                    >
                                        ✏️ Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(report.$id)}
                                        className="btn btn-danger btn-sm"
                                    >
                                        🗑️ Delete
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}

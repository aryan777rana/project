import { createContext, useContext, useEffect, useState } from "react";
import { account } from "../lib/appwrite";
import { ID } from "appwrite";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkUser();
    }, []);

    async function checkUser() {
        try {
            const session = await account.get();
            setUser(session);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }

    async function login(email, password) {
        await account.createEmailPasswordSession(email, password);
        await checkUser();
    }

    async function register(email, password, name) {
        await account.create(ID.unique(), email, password, name);
        await login(email, password);
    }

    async function logout() {
        await account.deleteSession("current");
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

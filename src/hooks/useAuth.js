import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, ADMIN_EMAIL } from "../firebase";

export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = 로딩중, null = 비로그인

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const isAdmin = user && user.email === ADMIN_EMAIL;

  return { user, isAdmin, loading: user === undefined };
}
